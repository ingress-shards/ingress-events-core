import { describe, it, expect } from "vitest";
import { WaveShardJumpBuilder } from "./WaveShardJumpBuilder.js";
import type { ShardPath, Shard } from "../Shard.js";
import type { EventTimeline, ScheduledShardAction } from "../../seasons/SeasonConfig.js";
import type { ObservedPortal } from "../Portal.js";
import type { ShardGoalScoringRule, ShardLinkScoringRule } from "../../types/index.js";

describe("WaveShardJumpBuilder", () => {
    it("should build shard jump windows with jump numbers and aggregate link mismatches", () => {
        const waveActions: ScheduledShardAction[] = [{ action: "jump", time: 1500 }];
        const wave = { start: 1000, end: 2000, shardsActions: waveActions };
        const shards = new Map<number, Shard>([
            [0, { history: [{ action: "jump", moveTime: 1500, portalId: 1, dest: 2, mismatch: true, team: "ENL" }] }],
            [1, { history: [{ action: "jump", moveTime: 1500, portalId: 1, dest: 2, mismatch: true, team: "ENL" }] }],
            [2, { history: [{ action: "jump", moveTime: 1500, portalId: 3, dest: 4, mismatch: true, team: "ENL" }] }]
        ]);

        const siteShardPaths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [{ linkTime: 1200, team: "RES", moves: [
                    { origin: 1, dest: 2, shardId: 0, moveTime: 1500, mismatch: true, scoredRules: ["rule1"] },
                    { origin: 1, dest: 2, shardId: 1, moveTime: 1500, mismatch: true, scoredRules: ["rule1"] }
                ]}]
            },
            "3-4": {
                distance: 100,
                links: [{ linkTime: 1200, team: "RES", moves: [
                    { origin: 3, dest: 4, shardId: 2, moveTime: 1500, mismatch: true, scoredRules: ["rule1"] }
                ]}]
            }
        };

        const timeline: EventTimeline = { start: 1000, preEventCutoff: 500, end: 2000, shards: [wave as any] };

        const windows = WaveShardJumpBuilder.build(wave, shards, {}, siteShardPaths, {}, {}, timeline);

        expect(windows).toHaveLength(1);
        expect(windows[0]!.jumpNumber).toBe(1);
        expect(windows[0]!.timestamp).toBe(1500);
        expect(windows[0]!.historyCount).toBe(3);

        // 3 shards jumped, but 2 were on link "1-2" and 1 was on link "3-4".
        // The number of mismatches should be 2.
        expect(windows[0]!.factionBreakdowns!.ENL!.linkAlignmentMismatches).toBe(2);
    });

    it("should correctly attribute movements across multiple jump windows and skip empty windows", () => {
        const waveActions: ScheduledShardAction[] = [
            { action: "spawn", time: 1000 },
            { action: "jump", time: 1500 },
            { action: "jump", time: 1800 },
            { action: "jump", time: 1950 },
            { action: "despawn", time: 2000 }
        ];
        const wave = { start: 1000, end: 2000, shardsActions: waveActions };

        const shards = new Map<number, Shard>([
            [0, { history: [
                { action: "jump", moveTime: 1500, portalId: 1, dest: 2 },
                { action: "jump", moveTime: 1800, portalId: 2, dest: 3 }
            ]}],
            [1, { history: [
                // Move registered at 1650 belongs to window 1 (1500 <= t < 1800)
                { action: "jump", moveTime: 1650, portalId: 4, dest: 5 }
            ]}]
        ]);

        const timeline: EventTimeline = { start: 1000, preEventCutoff: 500, end: 2000, shards: [wave as any] };

        const windows = WaveShardJumpBuilder.build(wave, shards, {}, {}, {}, {}, timeline);

        // Window 1 (1500) has shard 0 at 1500 and shard 1 at 1650 -> count 2
        // Window 2 (1800) has shard 0 at 1800 -> count 1
        // Window 3 (1950) has no movements -> skipped
        expect(windows).toHaveLength(2);

        expect(windows[0]!.jumpNumber).toBe(1);
        expect(windows[0]!.timestamp).toBe(1500);
        expect(windows[0]!.historyCount).toBe(2);

        expect(windows[1]!.jumpNumber).toBe(2);
        expect(windows[1]!.timestamp).toBe(1800);
        expect(windows[1]!.historyCount).toBe(1);
    });

    it("should calculate link points and breakdowns for scored moves", () => {
        const waveActions: ScheduledShardAction[] = [{ action: "jump", time: 1500 }];
        const wave = { start: 1000, end: 2000, shardsActions: waveActions };
        const shards = new Map<number, Shard>([
            [0, { history: [{ action: "link", moveTime: 1500, portalId: 1, dest: 2 }] }]
        ]);

        const siteShardPaths: Record<string, ShardPath> = {
            "1-2": {
                distance: 200,
                links: [{
                    linkTime: 1200,
                    team: "RES",
                    moves: [
                        { origin: 1, dest: 2, shardId: 0, moveTime: 1500, scoredRules: ["jump_rule"] }
                    ]
                }]
            }
        };

        const linkRules: Record<string, ShardLinkScoringRule> = {
            jump_rule: { label: "Jump Rule", points: 2 }
        };

        const timeline: EventTimeline = { start: 1000, preEventCutoff: 500, end: 2000, shards: [wave as any] };

        const windows = WaveShardJumpBuilder.build(wave, shards, {}, siteShardPaths, {}, linkRules, timeline);

        expect(windows).toHaveLength(1);
        expect(windows[0]!.points.RES).toBe(2);
        expect(windows[0]!.factionBreakdowns!.RES!.links).toEqual({ jump_rule: 1 });
    });

    it("should score goal arrivals via GoalScoringEngine", () => {
        const waveActions: ScheduledShardAction[] = [{ action: "jump", time: 1500 }];
        const wave = { start: 1000, end: 2000, shardsActions: waveActions };
        const shards = new Map<number, Shard>([
            [0, { history: [{ action: "jump", moveTime: 1500, portalId: 1, dest: 2 }] }]
        ]);

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Origin", latE6: 0, lngE6: 0 },
            2: {
                title: "Target RES",
                latE6: 0,
                lngE6: 0,
                history: [{ type: "target", timestamp: 1200, ornId: "targetres" }]
            }
        };

        const goalRules: Record<string, ShardGoalScoringRule> = {
            target_secured: { label: "Target Secured", points: 5 }
        };

        const timeline: EventTimeline = {
            start: 1000,
            preEventCutoff: 500,
            end: 2000,
            shards: [wave as any],
            targets: [{ waveNumber: 1, start: 1000, end: 2000 }]
        };

        const windows = WaveShardJumpBuilder.build(wave, shards, portals, {}, goalRules, {}, timeline);

        expect(windows).toHaveLength(1);
        expect(windows[0]!.points.RES).toBe(5);
        expect(windows[0]!.factionBreakdowns!.RES!.goals).toEqual([
            { portalId: 2, scoredCount: 1, unscoredCount: 0 }
        ]);
    });
});
