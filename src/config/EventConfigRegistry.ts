import type { EventBlueprints, SeasonGeocode, SeasonManifest } from "../types/index.js";
import type { SeasonId, SiteId } from "../common/Identifiers.js";
import type { SeasonConfig, SiteConfig, EventTimeline, WaveTimeline, ScheduledShardAction } from "../seasons/SeasonConfig.js";
import { isWithinSiteRange, haversineDistance, SITE_AGGREGATION_DISTANCE_METERS, SITE_PROXIMITY_WARNING_DISTANCE_METERS } from "../common/Geo.js";
import { parseZonedDateTime } from "../common/Date.js";

export class EventConfigRegistry {
    private readonly siteToSeasonMap: Map<SiteId, { seasonId: SeasonId; config: SiteConfig }> = new Map<SiteId, { seasonId: SeasonId; config: SiteConfig }>();
    public readonly seasons: Record<SeasonId, SeasonConfig> = {};

    constructor(inputs: {
        eventBlueprints: EventBlueprints;
        seasonManifest: SeasonManifest;
        seasonGeocode: SeasonGeocode;
    }) {
        const { eventBlueprints, seasonManifest, seasonGeocode } = inputs;
        const siteConfigCache: Record<SiteId, SiteConfig> = {};

        // 1. Process all seasons from manifest
        for (const season of seasonManifest.seasons) {
            const geocodeSeason = seasonGeocode.seasons.find(s => s.id === season.id);
            const seasonSitesConfig: Record<SiteId, SiteConfig> = {};

            // Initialize season metadata
            this.seasons[season.id] = {
                metadata: {
                    id: season.id,
                    name: season.name,
                    year: season.year,
                    overviewUrl: season.overviewUrl,
                    components: season.components
                },
                sites: seasonSitesConfig
            };

            for (const component of season.components) {
                // Find matching geocodes for this component event type
                const componentSites = geocodeSeason?.sites.filter(s => s.eventType === component.eventType) ?? [];

                // Resolve mechanics blueprints
                const shardMechanics = component.mechanics.shards?.shardMechanics ? eventBlueprints.shardMechanics[component.mechanics.shards.shardMechanics] : undefined;
                const targetMechanics = component.mechanics.shards?.targetMechanics ? eventBlueprints.targetMechanics[component.mechanics.shards.targetMechanics] : undefined;

                for (const site of componentSites) {
                    // Resolve site config (with potential schedule overrides from component)
                    const startMs = parseZonedDateTime(site.startTime).epochMilliseconds;
                    const preEventCutoffMs = startMs - 2 * 60 * 60 * 1000;

                    // Determine end time by finding max end offset from shard or target mechanics
                    let maxEndOffsetMinutes = 240; // fallback default of 4 hours
                    const shardWaves = shardMechanics?.waves ?? [];
                    const targetWaves = targetMechanics?.waves ?? [];
                    const allWaves = [...shardWaves, ...targetWaves];
                    if (allWaves.length > 0) {
                        maxEndOffsetMinutes = Math.max(...allWaves.map(w => w.endOffset));
                    }
                    const endMs = startMs + maxEndOffsetMinutes * 60 * 1000;

                    // Compute shard wave schedules
                    const shards: WaveTimeline[] = shardWaves.map((w, index) => {
                        const waveStart = startMs + w.startOffset * 60 * 1000;
                        const waveEnd = startMs + w.endOffset * 60 * 1000;

                        // Resolve wave actions absolute timestamps
                        const shardsActions: ScheduledShardAction[] = (shardMechanics?.waveActions ?? []).map(action => ({
                            action: action.action,
                            time: waveStart + action.time * 60 * 1000
                        }));

                        return {
                            waveNumber: index + 1,
                            start: waveStart,
                            end: waveEnd,
                            shardsActions
                        };
                    });

                    // Compute target wave schedules
                    const targets: WaveTimeline[] = targetWaves.map((w, index) => {
                        const waveStart = startMs + w.startOffset * 60 * 1000;
                        const waveEnd = startMs + w.endOffset * 60 * 1000;

                        const shardsActions: ScheduledShardAction[] = (targetMechanics?.waveActions ?? []).map(action => ({
                            action: action.action as any,
                            time: waveStart + action.time * 60 * 1000
                        }));

                        return {
                            waveNumber: index + 1,
                            start: waveStart,
                            end: waveEnd,
                            shardsActions
                        };
                    });

                    const timeline: EventTimeline = {
                        start: startMs,
                        preEventCutoff: preEventCutoffMs,
                        end: endMs,
                        shards,
                        ...(targets.length > 0 && { targets })
                    };

                    let shardsConfig: SiteConfig["mechanics"]["shards"] = undefined;
                    
                    if (shardMechanics && component.mechanics.shards) {
                        shardsConfig = {
                            shardMechanics,
                            ...(targetMechanics && { targetMechanics }),
                            scoring: {
                                ...(component.mechanics.shards.scoring.wavePointAggregation && {
                                    wavePointAggregation: component.mechanics.shards.scoring.wavePointAggregation
                                }),
                                ...(component.mechanics.shards.scoring.seasonPoints !== undefined && {
                                    seasonPoints: component.mechanics.shards.scoring.seasonPoints
                                }),
                                linkScoringRules: {}
                            }
                        };

                        const { linkRules = [], goalRules = [] } = component.mechanics.shards.scoring;
                        
                        // Pick out link scoring rules from blueprints
                        if (linkRules.length > 0) {
                            for (const ruleId of linkRules) {
                                const rule = eventBlueprints.linkScoringRules?.[ruleId];
                                if (rule) {
                                    shardsConfig.scoring.linkScoringRules[ruleId] = rule;
                                }
                            }
                        }

                        // Pick out goal scoring rules from blueprints
                        if (goalRules.length > 0) {
                            shardsConfig.scoring.goalScoringRules = {};
                            for (const ruleId of goalRules) {
                                const rule = eventBlueprints.goalScoringRules?.[ruleId];
                                if (rule) {
                                    shardsConfig.scoring.goalScoringRules[ruleId] = rule;
                                }
                            }
                        }
                    }

                    const siteConfig: SiteConfig = {
                        geocode: site,
                        timeline,
                        mechanics: {
                            ...(shardsConfig && { shards: shardsConfig })
                        },
                        ...(component.display && { display: component.display })
                    };

                    siteConfigCache[site.id] = siteConfig;
                    this.siteToSeasonMap.set(site.id, { seasonId: season.id, config: siteConfig });
                    seasonSitesConfig[site.id] = siteConfig;
                }
            }
        }
    }

    private getNearbyUpcomingSites(latE6: number, lngE6: number, timestampMs: number): string[] {
        const candidates: { siteId: SiteId; distanceMeters: number }[] = [];
        for (const [siteId, entry] of this.siteToSeasonMap) {
            if (entry.config.timeline.start <= timestampMs) {
                continue;
            }
            if (isWithinSiteRange({ latE6, lngE6 }, entry.config.geocode, SITE_AGGREGATION_DISTANCE_METERS, SITE_PROXIMITY_WARNING_DISTANCE_METERS)) {
                const distanceMeters = haversineDistance({ latE6, lngE6 }, entry.config.geocode);
                candidates.push({ siteId, distanceMeters });
            }
        }
        candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
        return candidates.map(c => `${c.siteId} (${(c.distanceMeters / 1000).toFixed(1)} km away)`);
    }

    public getSeasonIdForSite(siteId: SiteId): SeasonId | undefined {
        return this.siteToSeasonMap.get(siteId)?.seasonId;
    }

    public getSiteConfig(siteId: SiteId): SiteConfig | undefined {
        return this.siteToSeasonMap.get(siteId)?.config;
    }

    public findSiteByCoords(latE6: number, lngE6: number, timestampMs: number): { siteId: SiteId; seasonId: SeasonId; config: SiteConfig } | undefined {
        const matches: { siteId: SiteId; seasonId: SeasonId; config: SiteConfig }[] = [];
        
        for (const [siteId, entry] of this.siteToSeasonMap) {
            if (isWithinSiteRange({ latE6, lngE6 }, entry.config.geocode)) {
                matches.push({ siteId, seasonId: entry.seasonId, config: entry.config });
            }
        }

        if (matches.length === 0) {
            const nearbyUpcoming = this.getNearbyUpcomingSites(latE6, lngE6, timestampMs);
            if (nearbyUpcoming.length > 0) {
                const obsLat = (latE6 / 1e6).toFixed(6);
                const obsLng = (lngE6 / 1e6).toFixed(6);
                console.warn(
                    `[EventConfigRegistry] Coordinates (${obsLat}, ${obsLng}) do not match any site within ${SITE_AGGREGATION_DISTANCE_METERS / 1000} km, but found upcoming site(s) nearby: ${nearbyUpcoming.join(", ")}. Check and adjust the site centroid in season_manifest.json.`
                );
            }
            return undefined;
        }

        // 1. Check for active/recent event matching (start <= timestampMs <= end + 60 mins)
        const activeMatch = matches.find(m => {
            const { start, end } = m.config.timeline;
            return timestampMs >= start && timestampMs <= end + 60 * 60 * 1000;
        });
        if (activeMatch) {
            return activeMatch;
        }

        // 2. Check for upcoming event matching (start > timestampMs)
        const upcomingMatches = matches.filter(m => m.config.timeline.start > timestampMs);
        upcomingMatches.sort((a, b) => a.config.timeline.start - b.config.timeline.start);
        
        if (upcomingMatches.length > 0) {
            return upcomingMatches[0];
        }

        // 3. Fallback: all coordinate-matching events are in the past
        const pastSites = matches.map(m => m.siteId).join(", ");
        const obsDate = new Date(timestampMs).toISOString();
        const obsLat = (latE6 / 1e6).toFixed(6);
        const obsLng = (lngE6 / 1e6).toFixed(6);

        const nearbyUpcoming = this.getNearbyUpcomingSites(latE6, lngE6, timestampMs);
        const hint = nearbyUpcoming.length > 0
            ? ` Found upcoming site(s) nearby: ${nearbyUpcoming.join(", ")}. Check and adjust the site centroid in season_manifest.json to encompass these coordinates.`
            : ` If this observation is for an upcoming event, verify that the site centroid in season_manifest.json is within ${SITE_AGGREGATION_DISTANCE_METERS / 1000} km of (${obsLat}, ${obsLng}).`;

        console.error(`[EventConfigRegistry] Coordinates (${obsLat}, ${obsLng}) match past site(s) ${pastSites}, but the observation at ${obsDate} is after all scheduled times.${hint}`);
        return undefined;
    }
}
