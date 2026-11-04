import { describe, it, expect } from "vitest";
import { DiagnosticsCalculator } from "./DiagnosticsCalculator.js";
import type { ShardPath } from "../../sites/Shard.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";
import type { WaveState } from "../../sites/Site.js";

describe("DiagnosticsCalculator", () => {
    it("should calculate linkAlignmentMismatches within wave timeframe", () => {
        const mockPaths: Record<string, ShardPath> = {
            "link-1": {
                links: [
                    {
                        linkTime: 1000,
                        align: "RES",
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 1,
                                moveTime: 1500,
                                mismatch: true,
                                scoredRules: ["default_jump"]
                            },
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 2,
                                moveTime: 2500,
                                mismatch: true,
                                scoredRules: ["default_jump"]
                            }
                        ]
                    }
                ],
                distance: 100
            }
        };

        const wave: ShardWaveTimeline = {
            waveNumber: 1,
            start: 1000,
            end: 2000,
            expectedShards: 5
        };

        const calculator = new DiagnosticsCalculator(new Map(), {}, mockPaths);
        const result = calculator.calculate(wave);

        expect(result).toBeDefined();
        expect(result?.linkAlignmentMismatches).toEqual({ RES: 1 });
    });

    it("should calculate linkAlignmentMismatches for NEU alignment links", () => {
        const mockPaths: Record<string, ShardPath> = {
            "link-1": {
                links: [
                    {
                        linkTime: 1000,
                        align: "NEU",
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 1,
                                moveTime: 1500,
                                mismatch: true,
                                scoredRules: ["default_jump"]
                            }
                        ]
                    }
                ],
                distance: 100
            }
        };

        const wave: ShardWaveTimeline = {
            waveNumber: 1,
            start: 1000,
            end: 2000,
            expectedShards: 5
        };

        const calculator = new DiagnosticsCalculator(new Map(), {}, mockPaths);
        const result = calculator.calculate(wave);

        expect(result).toBeDefined();
        expect(result?.linkAlignmentMismatches).toEqual({ NEU: 1 });
    });

    it("should return undefined if no linkAlignmentMismatches occurred in wave", () => {
        const mockPaths: Record<string, ShardPath> = {
            "link-1": {
                links: [
                    {
                        linkTime: 1000,
                        align: "RES",
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 1,
                                moveTime: 1500,
                                mismatch: false,
                                scoredRules: ["default_jump"]
                            }
                        ]
                    }
                ],
                distance: 100
            }
        };

        const wave: ShardWaveTimeline = {
            waveNumber: 1,
            start: 1000,
            end: 2000,
            expectedShards: 5
        };

        const calculator = new DiagnosticsCalculator(new Map(), {}, mockPaths);
        const result = calculator.calculate(wave);

        expect(result).toBeUndefined();
    });

    it("should aggregate diagnostics across multiple wave states", () => {
        const waveStates: Record<number, WaveState> = {
            1: {
                points: { total: {}, links: {} },
                statistics: { shards: { moving: 0, nonMoving: 0 }, links: 0, paths: 0 },
                shardJumpWindows: [],
                diagnostics: { linkAlignmentMismatches: { RES: 2 } }
            },
            2: {
                points: { total: {}, links: {} },
                statistics: { shards: { moving: 0, nonMoving: 0 }, links: 0, paths: 0 },
                shardJumpWindows: [],
                diagnostics: { linkAlignmentMismatches: { RES: 3 } }
            },
            3: {
                points: { total: {}, links: {} },
                statistics: { shards: { moving: 0, nonMoving: 0 }, links: 0, paths: 0 },
                shardJumpWindows: []
            }
        };

        const calculator = new DiagnosticsCalculator(new Map(), {}, {});
        const result = calculator.aggregate(waveStates);

        expect(result).toBeDefined();
        expect(result?.linkAlignmentMismatches).toEqual({ RES: 5 });
    });
});
