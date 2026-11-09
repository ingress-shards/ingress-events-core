import { describe, it, expect } from "vitest";
import { StatisticsCalculator } from "./StatisticsCalculator.js";
import type { Shard, ShardPath } from "../../sites/Shard.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { WaveState, ShardJumpWindow } from "../../sites/Site.js";

describe("StatisticsCalculator", () => {
    it("should calculate moving, non-moving, links, paths, and targets for a site", () => {
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

        const calculator = new StatisticsCalculator(shards, portals, paths);
        const stats = calculator.calculateSiteStatistics();

        expect(stats.shards.moving).toBe(1);
        expect(stats.shards.nonMoving).toBe(1);
        expect(stats.links).toBe(1);
        expect(stats.paths).toBe(1);
        expect(stats.targets).toBe(1);
    });

    it("should count distinct unique links across the site", () => {
        const paths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1200,
                        align: "RES",
                        moves: [
                            { origin: 1, dest: 2, moveTime: 1200, shardId: 1 },
                            { origin: 1, dest: 2, moveTime: 1200, shardId: 2 }
                        ]
                    }
                ]
            }
        };

        const calculator = new StatisticsCalculator(new Map(), {}, paths);
        const stats = calculator.calculateSiteStatistics();

        expect(stats.links).toBe(1);
        expect(stats.paths).toBe(1);
    });

    it("should return populated statistics for single-wave sites via calculateSiteStatistics", () => {
        const waveStates: WaveState[] = [
            {
                points: { total: {}, links: {} },
                shardJumpWindows: [
                    { scheduledStart: 1000, actualEnd: 1030000, jumpNumber: 1, actionCount: 5 }
                ]
            }
        ];

        const calculator = new StatisticsCalculator(new Map(), {}, {});
        const stats = calculator.calculateSiteStatistics(waveStates);

        expect(stats).toBeDefined();
        expect(stats.extendedJumpWindows).toBe(1);
    });

    it("should calculate site-wide mismatchedMoves count including NEU links", () => {
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "link", moveTime: 1200, portalId: 1, dest: 2, mismatch: { originAlign: "NEU" } },
                    { action: "link", moveTime: 1250, portalId: 1, dest: 2, mismatch: { destAlign: "ENL" } },
                    { action: "link", moveTime: 1300, portalId: 1, dest: 2 }
                ]
            }]
        ]);

        const paths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1000,
                        align: "NEU",
                        moves: [{ origin: 1, dest: 2, moveTime: 1200, shardId: 1 }]
                    },
                    {
                        linkTime: 1100,
                        align: "ENL",
                        moves: [{ origin: 1, dest: 2, moveTime: 1250, shardId: 1 }]
                    },
                    {
                        linkTime: 1150,
                        align: "RES",
                        moves: [{ origin: 1, dest: 2, moveTime: 1300, shardId: 1 }]
                    }
                ]
            }
        };

        const calculator = new StatisticsCalculator(shards, {}, paths);
        const stats = calculator.calculateSiteStatistics();

        expect(stats.mismatchedMoves).toBe(2);
    });

    it("should calculate site-wide extendedJumpWindows when duration > 1 minute", () => {
        const windows: ShardJumpWindow[] = [
            { scheduledStart: 1000, actualEnd: 1030000, jumpNumber: 1, actionCount: 5 }, // 1029s > 60s -> extended
            { scheduledStart: 2000000, actualEnd: 2000030, jumpNumber: 2, actionCount: 2 }, // 30s <= 60s -> not extended
            { scheduledStart: 3000000, actualEnd: 3060001, jumpNumber: 3, actionCount: 4 }  // 60.001s > 60s -> extended
        ];
        const waveStates: WaveState[] = [
            { points: { total: {}, links: {} }, shardJumpWindows: windows }
        ];

        const calculator = new StatisticsCalculator(new Map(), {}, {});
        const stats = calculator.calculateSiteStatistics(waveStates);

        expect(stats.extendedJumpWindows).toBe(2);
    });

    it("should calculate site-wide invalidActions", () => {
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "spawn", moveTime: 1000, portalId: 1 },
                    { action: "link", moveTime: 1200, portalId: 1, dest: 2 },
                    { action: "link", moveTime: 1400, portalId: 3, dest: 4, invalid: true }
                ]
            }],
            [2, {
                history: [
                    { action: "spawn", moveTime: 1000, portalId: 1 },
                    { action: "despawn", moveTime: 1500, portalId: 1, invalid: true }
                ]
            }]
        ]);

        const calculator = new StatisticsCalculator(shards, {}, {});
        const stats = calculator.calculateSiteStatistics();

        expect(stats.invalidActions).toBe(2);
    });

    it("should calculate wave statistics with basic metrics and no diagnostic anomalies", () => {
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "spawn", moveTime: 1000, portalId: 1 },
                    { action: "link", moveTime: 1200, portalId: 1, dest: 2 }
                ]
            }],
            [2, {
                history: [
                    { action: "spawn", moveTime: 1000, portalId: 1 }
                ]
            }]
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

        const calculator = new StatisticsCalculator(shards, portals, paths);
        const waveStats = calculator.calculateWaveStatistics({
            waveNumber: 1,
            start: 1000,
            end: 2000,
        });

        expect(waveStats.shards.moving).toBe(1);
        expect(waveStats.shards.nonMoving).toBe(1);
        expect(waveStats.links).toBe(1);
        expect(waveStats.paths).toBe(1);
        expect(waveStats.targets).toBe(1);
        // Verify no diagnostic properties on wave stats
        expect("mismatchedMoves" in waveStats).toBe(false);
        expect("invalidActions" in waveStats).toBe(false);
        expect("extendedJumpWindows" in waveStats).toBe(false);
    });
});
