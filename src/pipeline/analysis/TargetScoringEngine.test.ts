import { describe, it, expect } from "vitest";
import { TargetScoringEngine } from "./TargetScoringEngine.js";
import type { Shard } from "../../sites/Shard.js";
import type { ShardGoalScoringRule } from "../../types/index.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { SiteTimeline } from "../../config/SiteConfig.js";

describe("TargetScoringEngine", () => {
    const timeline: SiteTimeline = {
        start: 1000,
        preEventCutoff: 500,
        end: 5000,
        durationMinutes: 67,
        shards: [
            {
                waveNumber: 1,
                start: 1000,
                end: 2000,
                expectedShards: 5,
                shardsActions: [
                    { action: "spawn", time: 1000 },
                    { action: "jump", time: 1500 }
                ]
            }
        ],
        targets: [
            {
                waveNumber: 1,
                start: 1000,
                end: 5000
            }
        ]
    };

    const rules: Record<string, ShardGoalScoringRule> = {
        "Target Goal": {
            label: "Target Goal",
            points: 5,
            conditions: {
                maxScoringShardsPerPortal: 1
            }
        }
    };

    const portals: Record<number, ObservedPortal> = {
        1: { title: "Portal 1", latE6: 0, lngE6: 0 },
        2: {
            title: "Target RES",
            latE6: 0,
            lngE6: 0,
            history: [
                { type: "target", timestamp: 1200, ornId: "targetres" }
            ]
        }
    };

    it("should score valid target jumps up to maxScoringShardsPerPortal limit", () => {
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "jump", moveTime: 1500, portalId: 1, dest: 2 }
                ]
            }],
            [2, {
                history: [
                    { action: "jump", moveTime: 1500, portalId: 1, dest: 2 }
                ]
            }]
        ]);

        const engine = new TargetScoringEngine(rules, timeline, shards, portals);
        const result = engine.scoreJumpWindow({ windowStart: 1500, waveStart: 1000, waveEnd: 2000 });

        // Max limit is 1, so only 1 shard scores 5 points for RES
        expect(result.jumpWindowPoints.RES).toBe(5);
        expect(result.jumpWindowPoints.ENL).toBe(0);
        expect(result.goalsBreakdown.RES).toEqual([
            { portalId: 2, scoredCount: 1, unscoredCount: 1 }
        ]);
    });

    it("should score a single jump window using JumpWindowBounds", () => {
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "jump", moveTime: 1500, portalId: 1, dest: 2 }
                ]
            }]
        ]);

        const engine = new TargetScoringEngine(rules, timeline, shards, portals);
        const result = engine.scoreJumpWindow(
            { windowStart: 1500, waveStart: 1000, waveEnd: 2000 }
        );

        expect(result.jumpWindowPoints.RES).toBe(5);
        expect(result.goalsBreakdown.RES).toEqual([
            { portalId: 2, scoredCount: 1 }
        ]);
    });

    it("should omit scoredCount when a subsequent jump window lands a shard on an already capped target portal", () => {
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "jump", moveTime: 1500, portalId: 1, dest: 2 }
                ]
            }],
            [2, {
                history: [
                    { action: "jump", moveTime: 1800, portalId: 1, dest: 2 }
                ]
            }]
        ]);

        const engine = new TargetScoringEngine(rules, timeline, shards, portals);

        // Window 1 (1500): Shard 1 lands on Portal 2 and reaches maxScoringShardsPerPortal = 1
        const w1 = engine.scoreJumpWindow({ windowStart: 1500, nextWindowStart: 1800, waveStart: 1000, waveEnd: 2000 });
        expect(w1.jumpWindowPoints.RES).toBe(5);
        expect(w1.goalsBreakdown.RES).toEqual([
            { portalId: 2, scoredCount: 1 }
        ]);

        // Window 2 (1800): Shard 2 lands on Portal 2, which is already capped -> scoredCount is 0 (omitted), unscoredCount is 1
        const w2 = engine.scoreJumpWindow({ windowStart: 1800, waveStart: 1000, waveEnd: 2000 });
        expect(w2.jumpWindowPoints.RES).toBe(0);
        expect(w2.goalsBreakdown.RES).toEqual([
            { portalId: 2, unscoredCount: 1 }
        ]);
        expect("scoredCount" in w2.goalsBreakdown.RES![0]!).toBe(false);
    });
});
