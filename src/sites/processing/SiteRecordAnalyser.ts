import type { SiteRecord, SiteAnalysis, SiteState } from "../Site.js";
import { calculateCentroid } from "../../common/Geo.js";
import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";

export const SiteRecordAnalyser = {
    /**
     * Enriches a SiteRecord by analyzing its observations to generate SiteAnalysis.
     * Overwrites or populates the analysis field.
     */
     analyze: (record: SiteRecord, config?: EventConfigRegistry): SiteAnalysis => {
        const portals = record.observations?.portals ? Object.values(record.observations.portals) : [];
        const shards = record.observations?.shards ? Object.values(record.observations.shards) : [];

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

                waveStates.push({
                    shardPaths: {},
                    points: {},
                    counters: {
                        shards: {
                            moving: waveMoving,
                            nonMoving: waveNonMoving,
                        },
                        links: waveLinks,
                        paths: 0,
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
                shardPaths: {},
                points: {},
                counters: {
                    shards: {
                        moving: movingShards,
                        nonMoving: nonMovingShards,
                    },
                    links: totalLinks,
                    paths: 0,
                },
            },
            waves: waveStates,
            siteScore: {},
            hasTargetData: false,
        };
    }
};
