import type { EventBlueprints, SeasonGeocode, SeasonManifest, SeasonMetadata, SeasonEvent, SiteGeocode, HostSite } from "../types/index.js";
import type { SeasonId, SiteId } from "../common/Identifiers.js";
import { DEFAULT_SITE_DURATION_MINUTES, type SiteConfig, type SiteTimeline, type ShardWaveTimeline, type TargetWaveTimeline, type ScheduledShardAction } from "./SiteConfig.js";
import { parseZonedDateTime } from "../common/Date.js";

export class ConfigRegistry {
    private readonly sites = new Map<SiteId, SiteConfig>();
    private readonly seasons = new Map<SeasonId, SeasonMetadata>();

    constructor(
        public readonly blueprints: EventBlueprints,
        public readonly manifest: SeasonManifest,
        public readonly geocode: SeasonGeocode
    ) {
        // 1. Index all seasons from manifest
        for (const season of manifest.seasons) {
            this.seasons.set(season.id, season);
            const geocodeSeason = geocode.seasons.find(s => s.id === season.id);

            for (const event of season.events) {
                // Find matching geocodes for this event type
                const eventSites = geocodeSeason?.sites.filter(s => s.eventType === event.eventType) ?? [];

                for (const site of eventSites) {
                    const timeline = this.buildSiteTimeline(site, season, event);
                    const siteConfig: SiteConfig = {
                        seasonId: season.id,
                        geocode: site,
                        timeline
                    };

                    this.sites.set(site.id, siteConfig);
                }
            }
        }
    }

    private buildSiteTimeline(site: SiteGeocode, season: SeasonMetadata, event: SeasonEvent): SiteTimeline {
        const shardMechanics = event.mechanics.shards?.shardMechanics
            ? this.blueprints.shardMechanics[event.mechanics.shards.shardMechanics]
            : undefined;
        const targetMechanics = event.mechanics.shards?.targetMechanics
            ? this.blueprints.targetMechanics[event.mechanics.shards.targetMechanics]
            : undefined;

        const startMs = parseZonedDateTime(site.startTime).epochMilliseconds;
        const preEventCutoffMs = startMs - 2 * 60 * 60 * 1000;

        let maxEndOffsetMinutes = 240;
        const shardWaves = shardMechanics?.waves ?? [];
        const targetWaves = targetMechanics?.waves ?? [];
        const allWaves = [...shardWaves, ...targetWaves];
        if (allWaves.length > 0) {
            maxEndOffsetMinutes = Math.max(...allWaves.map(w => w.endOffset));
        }
        const endMs = startMs + maxEndOffsetMinutes * 60 * 1000;

        let hostSite: HostSite | undefined;
        if (event.schedule) {
            for (const day of event.schedule) {
                hostSite = day.sites.find(s => s.latE6 === site.latE6 && s.lngE6 === site.lngE6);
                if (hostSite) break;
            }
        }

        const shards: ShardWaveTimeline[] = shardWaves.map((w, index) => {
            const waveStart = startMs + w.startOffset * 60 * 1000;
            const waveEnd = startMs + w.endOffset * 60 * 1000;

            const shardsActions: ScheduledShardAction[] = (shardMechanics?.waveActions ?? []).map(action => ({
                action: action.action,
                time: waveStart + action.time * 60 * 1000
            }));

            let expectedShards: number;
            const overrideCount = hostSite?.shardCounts?.[index];
            if (typeof overrideCount === "number") {
                expectedShards = overrideCount;
            } else if (typeof w.quantity === "number") {
                expectedShards = w.quantity;
            } else {
                throw new TypeError(
                    `Invalid configuration: Missing shard quantity for wave ${index + 1} of ${shardWaves.length} at site '${site.id}' (${site.name}) in season '${season.id}' (${event.eventType}, mechanics: '${event.mechanics.shards?.shardMechanics}').`
                );
            }

            return {
                waveNumber: index + 1,
                start: waveStart,
                end: waveEnd,
                expectedShards,
                shardsActions
            };
        });

        const targets: TargetWaveTimeline[] = targetWaves.map((w, index) => {
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

        const durationMinutes = Math.round((endMs - startMs) / (60 * 1000));
        const jumpGroupSize = event.mechanics.shards?.jumpGroupSize;

        return {
            start: startMs,
            preEventCutoff: preEventCutoffMs,
            end: endMs,
            durationMinutes,
            ...(jumpGroupSize !== undefined && { jumpGroupSize }),
            shards,
            ...(targets.length > 0 && { targets })
        };
    }

    public getSiteConfig(siteId: SiteId): SiteConfig | undefined {
        return this.sites.get(siteId);
    }

    /**
     * Retrieves the duration of a site event in minutes.
     * Returns the site's configured timeline duration if present, falling back to DEFAULT_SITE_DURATION_MINUTES (240).
     */
    public getSiteDurationMinutes(siteId: SiteId): number {
        return this.getSiteConfig(siteId)?.timeline.durationMinutes ?? DEFAULT_SITE_DURATION_MINUTES;
    }

    public getAllSites(): SiteConfig[] {
        return [...this.sites.values()];
    }

    public getSitesForSeason(seasonId: SeasonId): SiteConfig[] {
        return [...this.sites.values()].filter(s => s.seasonId === seasonId);
    }

    public getSeasonMetadata(seasonId: SeasonId): SeasonMetadata | undefined {
        return this.seasons.get(seasonId);
    }

    public getAllSeasonIds(): SeasonId[] {
        return this.manifest.seasons.map(s => s.id);
    }

    public getDefaultSeasonId(): SeasonId | undefined {
        return this.manifest.seasons.find(s => s.defaultView)?.id ?? this.manifest.seasons[0]?.id;
    }
}
