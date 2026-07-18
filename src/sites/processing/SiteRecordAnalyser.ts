import type { SiteRecord, SiteAnalysis, SiteState } from "../Site.js";
import { calculateCentroid, haversineDistance } from "../../common/Geo.js";
import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";
import type { Shard, ShardHistoryEntry, ShardPath } from "../Shard.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ObservedPortal } from "../Portal.js";
import { roundToDecimalPlaces } from "../../common/Math.js";

const buildShardPaths = (
    shardEntries: [string, Shard][],
    portals: Record<PortalId, ObservedPortal> | undefined,
    filterFunction?: (h: ShardHistoryEntry) => boolean
): Record<string, ShardPath> => {
    const paths: Record<string, ShardPath> = {};

    for (const [shardIdStr, shard] of shardEntries) {
        const shardId = Number(shardIdStr);
        const history = shard.history || [];
        const filteredHistory = filterFunction ? history.filter(filterFunction) : history;

        for (const h of filteredHistory) {
            if (h.action === "link") {
                const origin = h.portalId;
                const destination = h.dest;
                if (destination === undefined) continue;

                // Key is concatenation of the two portal IDs, in numerical order, with a dash
                const p1 = Math.min(origin, destination);
                const p2 = Math.max(origin, destination);
                const pathKey = `${p1}-${p2}`;

                // Calculate distance if portals are available
                let distance = 0;
                const portal1 = portals?.[p1];
                const portal2 = portals?.[p2];
                if (portal1 && portal2) {
                    distance = roundToDecimalPlaces(haversineDistance(portal1, portal2), 2);
                }

                // Initialize path if not present
                paths[pathKey] ??= {
                    links: [],
                    distance
                };

                const linkTime = h.linkTime ?? h.moveTime;
                const team = h.team ?? "NEU";

                // Find or create the link on this path
                let existingLink = paths[pathKey].links.find(l => l.linkTime === linkTime);
                if (!existingLink) {
                    existingLink = {
                        linkTime,
                        team,
                        moves: []
                    };
                    paths[pathKey].links.push(existingLink);
                }

                // Add shard move along the link
                const moveExists = existingLink.moves.some(m => m.shardId === shardId && m.moveTime === h.moveTime);
                if (!moveExists) {
                    existingLink.moves.push({
                        origin,
                        dest: destination,
                        shardId,
                        moveTime: h.moveTime,
                        points: 0
                    });
                }
            }
        }
    }

    // Sort links by linkTime, and moves by moveTime
    for (const path of Object.values(paths)) {
        path.links.sort((a, b) => a.linkTime - b.linkTime);
        for (const link of path.links) {
            link.moves.sort((a, b) => a.moveTime - b.moveTime);
        }
    }

    return paths;
};

export const SiteRecordAnalyser = {
    /**
     * Enriches a SiteRecord by analyzing its observations to generate SiteAnalysis.
     * Overwrites or populates the analysis field.
     */
    analyze: (record: SiteRecord, config?: EventConfigRegistry): SiteAnalysis => {
        const portals = record.observations?.portals ? Object.values(record.observations.portals) : [];
        const shardEntries = record.observations?.shards ? Object.entries(record.observations.shards) : [];
        const shards = shardEntries.map(([, s]) => s);
        const portalsMap = record.observations?.portals;

        // 1. Calculate Centroid
        const portalCoordinates = portals.map(p => ({ latE6: p.latE6, lngE6: p.lngE6 }));
        const centroid = calculateCentroid(portalCoordinates);

        // 2. Calculate Shard and Link Counters
        let movingShards = 0;
        let nonMovingShards = 0;
        let totalLinks = 0;

        for (const shard of shards) {
            const history = shard.history || [];
            const hasMoved = history.some(h => h.action === "link" || h.action === "jump");

            if (hasMoved) {
                movingShards++;
            } else {
                nonMovingShards++;
            }

            const shardLinks = history.filter(h => h.action === "link").length;
            totalLinks += shardLinks;
        }

        // Calculate Overall Shard Paths
        const overallShardPaths = buildShardPaths(shardEntries, portalsMap);

        // 3. Calculate Wave Snapshots
        const waveStates: SiteState[] = [];
        const siteConfig = config?.getSiteConfig(record.metadata.siteId);
        const actionSchedule = siteConfig?.actionSchedule;

        if (actionSchedule?.waves) {
            for (const wave of actionSchedule.waves) {
                let waveMoving = 0;
                let waveNonMoving = 0;
                let waveLinks = 0;

                for (const shard of shards) {
                    const history = shard.history || [];

                    // Filter history entries up to the end of this wave
                    const historyUpToWaveEnd = history.filter(h => h.moveTime <= wave.end);
                    if (historyUpToWaveEnd.length === 0) {
                        continue;
                    }

                    // Check if it already despawned in a previous wave
                    const latestBeforeWave = historyUpToWaveEnd.at(-1)!;
                    if (latestBeforeWave.action === "despawn" && latestBeforeWave.moveTime < wave.start) {
                        continue;
                    }

                    // Check if it moved in this wave
                    const waveHistory = history.filter(h => h.moveTime >= wave.start && h.moveTime <= wave.end);
                    const hasMoved = waveHistory.some(h => h.action === "jump" || h.action === "link");

                    if (hasMoved) {
                        waveMoving++;
                    } else {
                        waveNonMoving++;
                    }

                    const shardLinks = waveHistory.filter(h => h.action === "link").length;
                    waveLinks += shardLinks;
                }

                const waveShardPaths = buildShardPaths(
                    shardEntries,
                    portalsMap,
                    h => h.moveTime >= wave.start && h.moveTime <= wave.end
                );

                waveStates.push({
                    shardPaths: waveShardPaths,
                    points: {},
                    counters: {
                        shards: {
                            moving: waveMoving,
                            nonMoving: waveNonMoving,
                        },
                        links: waveLinks,
                        paths: Object.keys(waveShardPaths).length,
                    },
                    period: {
                        start: wave.start,
                        end: wave.end,
                    }
                });
            }
        }

        return {
            ...(centroid && { centroid }),
            siteState: {
                shardPaths: overallShardPaths,
                points: {},
                counters: {
                    shards: {
                        moving: movingShards,
                        nonMoving: nonMovingShards,
                    },
                    links: totalLinks,
                    paths: Object.keys(overallShardPaths).length,
                },
            },
            waves: waveStates,
            siteScore: {},
            hasTargetData: false,
        };
    }
};
