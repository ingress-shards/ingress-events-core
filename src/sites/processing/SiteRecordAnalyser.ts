import type { SiteRecord, SiteAnalysis } from "../Site.js";
import { calculateCentroid } from "../../common/Geo.js";

export const SiteRecordAnalyzer = {
    /**
     * Enriches a SiteRecord by analyzing its observations to generate SiteAnalysis.
     * Overwrites or populates the analysis field.
     */
    analyze: (record: SiteRecord): SiteAnalysis => {
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
            waves: [],
            siteScore: {},
            hasTargetData: false,
        };
    }
};
