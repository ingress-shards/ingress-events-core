import { describe, it, expect } from "vitest";
import { SiteRecordAnalyser } from "./SiteRecordAnalyser.js";
import type { SiteRecord } from "../Site.js";
import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";

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
        expect(analysis.siteState.counters.shards.moving).toBe(0);
        expect(analysis.siteState.counters.shards.nonMoving).toBe(0);
        expect(analysis.siteState.counters.links).toBe(0);
    });

    it("should calculate correct centroid and shard/link counters", () => {
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
                        shardNumber: 101,
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "link", moveTime: 2000, portalId: 1, dest: 2 },
                        ],
                    },
                    102: {
                        shardNumber: 102,
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

        // Shard counts:
        // Shard 101 moved (action: link) -> moving = 1
        // Shard 102 did not move -> nonMoving = 1
        expect(analysis.siteState.counters.shards.moving).toBe(1);
        expect(analysis.siteState.counters.shards.nonMoving).toBe(1);

        // Links: Shard 101 has 1 link action
        expect(analysis.siteState.counters.links).toBe(1);
    });

    it("should calculate correct wave-by-wave shard and link counts when config is provided", () => {
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
                        shardNumber: 101,
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "jump", moveTime: 150000, portalId: 1 },
                            { action: "despawn", moveTime: 2000000, portalId: 1 }
                        ] as any,
                    },
                    102: {
                        shardNumber: 102,
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "link", moveTime: 2500000, portalId: 1, dest: 2 }
                        ] as any,
                    },
                },
            },
        };

        const mockConfig: any = {
            getSiteConfig: (siteId: string) => {
                expect(siteId).toBe("test-site");
                return {
                    actionSchedule: {
                        start: 1000,
                        waves: [
                            {
                                waveNumber: 1,
                                start: 121000,
                                end: 181000,
                            },
                            {
                                waveNumber: 2,
                                start: 1921000,
                                end: 3601000,
                            }
                        ]
                    }
                };
            }
        };

        const analysis = SiteRecordAnalyser.analyze(record, mockConfig as unknown as EventConfigRegistry);
        expect(analysis.waves.length).toBe(2);

        // Wave 1 checks:
        const w1 = analysis.waves[0]!;
        expect(w1.period?.start).toBe(121000);
        expect(w1.counters.shards.moving).toBe(1); // Shard 101 jumped
        expect(w1.counters.shards.nonMoving).toBe(1); // Shard 102 present but not moving
        expect(w1.counters.links).toBe(0);

        // Wave 2 checks:
        const w2 = analysis.waves[1]!;
        expect(w2.period?.start).toBe(1921000);
        expect(w2.counters.shards.moving).toBe(1); // Shard 102 linked
        expect(w2.counters.shards.nonMoving).toBe(1); // Shard 101 present but despawned (not jump/link)
        expect(w2.counters.links).toBe(1); // 1 link from Shard 102
    });
});
