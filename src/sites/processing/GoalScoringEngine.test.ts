import { describe, it, expect } from "vitest";
import { GoalScoringEngine } from "./GoalScoringEngine.js";
import type { Shard } from "../Shard.js";
import type { ShardGoalScoringRule } from "../../types/index.js";
import type { ObservedPortal } from "../Portal.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

describe("GoalScoringEngine", () => {
    const timeline: EventTimeline = {
        start: 1000,
        preEventCutoff: 500,
        end: 5000,
        shards: [
            {
                waveNumber: 1,
                start: 1000,
                end: 2000,
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

        const wave = timeline.shards[0]!;
        
        const wavePoints = GoalScoringEngine.scoreWave(wave, shards, portals, rules, timeline);

        // Max limit is 1, so only 1 shard scores 5 points for RES
        expect(wavePoints.RES).toBe(5);
        expect(wavePoints.ENL).toBe(0);
    });
});
