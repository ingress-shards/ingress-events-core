import { describe, it, expect } from "vitest";
import { StatisticsCalculator } from "./StatisticsCalculator.js";
import type { Shard, ShardPath } from "../Shard.js";
import type { ObservedPortal } from "../Portal.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";
import type { WaveState } from "../Site.js";

describe("StatisticsCalculator", () => {
    it("should calculate moving, non-moving, links, paths, and targets for a wave", () => {
        const shards = new Map<number, Shard>([
            [
                1,
                {
                    history: [
                        { action: "spawn", moveTime: 1000, portalId: 1 },
                        { action: "jump", moveTime: 1200, portalId: 1, dest: 2 },
                        { action: "link", moveTime: 1200, portalId: 1, dest: 2 }
                    ]
                }
            ],
            [
                2,
                {
                    history: [
                        { action: "spawn", moveTime: 1000, portalId: 1 }
                    ]
                }
            ]
        ]);

        const portals: Record<string, ObservedPortal> = {
            "p-1": {
                title: "Portal 1",
                latE6: 0,
                lngE6: 0,
                history: [
                    { type: "target", timestamp: 1500, ornId: "targetres" }
                ]
            }
        };

        const paths: Record<string, ShardPath> = {
            "p1-p2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1200,
                        align: "RES",
                        moves: [{ origin: 1, dest: 2, moveTime: 1200, shardId: 1 }]
                    }
                ]
            }
        };

        const wave: ShardWaveTimeline = {
            waveNumber: 1,
            start: 1000,
            end: 2000,
            expectedShards: 2
        };

        const calculator = new StatisticsCalculator(shards, portals, paths);
        const stats = calculator.calculate(wave);

        expect(stats.shards.moving).toBe(1);
        expect(stats.shards.nonMoving).toBe(1);
        expect(stats.links).toBe(1);
        expect(stats.paths).toBe(1);
        expect(stats.targets).toBe(1);
    });

    it("should return undefined for site aggregation when wave count is <= 1", () => {
        const waveStates: Record<number, WaveState> = {
            1: {
                points: { total: {}, links: {} },
                statistics: { shards: { moving: 1, nonMoving: 0 }, links: 1, paths: 1 },
                shardJumpWindows: []
            }
        };

        const calculator = new StatisticsCalculator(new Map(), {}, {});
        expect(calculator.aggregate(waveStates)).toBeUndefined();
    });

    it("should aggregate statistics across multiple waves when wave count > 1", () => {
        const waveStates: Record<number, WaveState> = {
            1: {
                points: { total: {}, links: {} },
                statistics: { shards: { moving: 2, nonMoving: 1 }, links: 3, paths: 2, targets: 1 },
                shardJumpWindows: []
            },
            2: {
                points: { total: {}, links: {} },
                statistics: { shards: { moving: 1, nonMoving: 2 }, links: 2, paths: 1, targets: 1 },
                shardJumpWindows: []
            }
        };

        const mockPaths: Record<string, ShardPath> = {
            "p1": { distance: 10, links: [] },
            "p2": { distance: 20, links: [] },
            "p3": { distance: 30, links: [] }
        };
        const calculator = new StatisticsCalculator(new Map(), {}, mockPaths);
        const aggregated = calculator.aggregate(waveStates);

        expect(aggregated).toBeDefined();
        expect(aggregated?.shards.moving).toBe(3);
        expect(aggregated?.shards.nonMoving).toBe(3);
        expect(aggregated?.links).toBe(5);
        expect(aggregated?.paths).toBe(3);
        expect(aggregated?.targets).toBe(2);
    });
});
