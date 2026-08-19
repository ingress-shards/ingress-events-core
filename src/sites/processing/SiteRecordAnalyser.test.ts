import { describe, it, expect } from "vitest";
import { SiteRecordAnalyser } from "./SiteRecordAnalyser.js";
import type { SiteRecord } from "../Site.js";
import { EventConfigRegistry } from "../../config/EventConfigRegistry.js";

describe("SiteRecordAnalyser", () => {
    it("should handle record with no observations", () => {
        const record: SiteRecord = {
            metadata: {
                siteId: "test-site",
                seasonId: "test-season",
                lastUpdated: 1000,
            },
        };

        const analysis = SiteRecordAnalyser.analyze(record);
        expect(analysis.centroid).toBeUndefined();
        expect(analysis.hasPreEventOrnaments).toBe(false);
        expect(analysis.waves).toEqual({});
        expect(analysis.siteShardPaths).toEqual({});
        expect(analysis.siteStatistics).toBeUndefined();
    });

    it("should calculate correct centroid and aggregated statistics when no config is provided", () => {
        const record: SiteRecord = {
            metadata: {
                siteId: "test-site",
                seasonId: "test-season",
                lastUpdated: 1000,
            },
            observations: {
                portals: {
                    1: { title: "P1", latE6: 10000000, lngE6: 20000000 },
                    2: { title: "P2", latE6: 20000000, lngE6: 40000000 },
                },
                shards: {
                    101: {
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "link", moveTime: 2000, portalId: 1, dest: 2, team: "RES" },
                        ],
                    },
                    102: {
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 2 },
                            { action: "no move", moveTime: 3000, portalId: 2 },
                        ],
                    },
                },
            },
        };

        const analysis = SiteRecordAnalyser.analyze(record);

        // Centroid calculation: avg(10, 20) = 15, avg(20, 40) = 30
        expect(analysis.centroid).toEqual({ latE6: 15000000, lngE6: 30000000 });
        expect(analysis.hasPreEventOrnaments).toBe(false);
        expect(analysis.siteShardPaths).toBeDefined();
        
        const pathObject = analysis.siteShardPaths!["1-2"];
        expect(pathObject).toBeDefined();
        expect(pathObject!.links.length).toBe(1);
        expect(pathObject!.links[0]!.team).toBe("RES");
        expect(pathObject!.links[0]!.moves.length).toBe(1);
        expect(pathObject!.links[0]!.moves[0]!.shardId).toBe(101);
    });

    it("should calculate correct wave-by-wave statistics and shardActionWindows when config is provided", () => {
        const record: SiteRecord = {
            metadata: {
                siteId: "test-site",
                seasonId: "test-season",
                lastUpdated: 1000,
            },
            observations: {
                portals: {
                    1: { title: "P1", latE6: 10000000, lngE6: 20000000 },
                },
                shards: {
                    101: {
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "jump", moveTime: 150000, portalId: 1 },
                            { action: "despawn", moveTime: 2000000, portalId: 1 }
                        ] as any,
                    },
                    102: {
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "link", moveTime: 2500000, portalId: 1, dest: 2, team: "ENL" }
                        ] as any,
                    },
                },
            },
        };

        const mockConfig = {
            getSiteConfig: (siteId: string) => {
                expect(siteId).toBe("test-site");
                return {
                    timeline: {
                        start: 1000,
                        preEventCutoff: 0,
                        end: 4000000,
                        shards: [
                            {
                                waveNumber: 1,
                                start: 121000,
                                end: 181000,
                                shardsActions: [
                                    { action: "spawn", time: 121000 },
                                    { action: "jump", time: 150000 }
                                ]
                            },
                            {
                                waveNumber: 2,
                                start: 1921000,
                                end: 3601000,
                                shardsActions: [
                                    { action: "despawn", time: 2000000 },
                                    { action: "jump", time: 2500000 }
                                ]
                            }
                        ]
                    }
                };
            }
        };

        const analysis = SiteRecordAnalyser.analyze(record, mockConfig as unknown as EventConfigRegistry);
        expect(Object.keys(analysis.waves).length).toBe(2);

        // Wave 1 checks:
        const w1 = analysis.waves[1]!;
        expect(w1).toBeDefined();
        expect(w1.statistics.shards.moving).toBe(1); // Shard 101 jumped
        expect(w1.statistics.shards.nonMoving).toBe(1); // Shard 102 present but not moving
        expect(w1.statistics.links).toBe(0);
        expect(w1.statistics.paths).toBe(0);
        expect(w1.shardActionWindows.length).toBe(1);
        expect(w1.shardActionWindows[0]!.timestamp).toBe(150000);
        expect(w1.shardActionWindows[0]!.actionsCount).toBe(1);

        // Wave 2 checks:
        const w2 = analysis.waves[2]!;
        expect(w2).toBeDefined();
        expect(w2.statistics.shards.moving).toBe(1); // Shard 102 linked
        expect(w2.statistics.shards.nonMoving).toBe(1); // Shard 101 present but despawned
        expect(w2.statistics.links).toBe(1);
        expect(w2.statistics.paths).toBe(1);
        expect(w2.shardActionWindows.length).toBe(1); // despawn removed, only link at 2500000 remains
    });
});
