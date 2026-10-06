import { describe, it, expect } from "vitest";
import { WaveActionLogBuilder } from "./WaveActionLogBuilder.js";
import type { ShardPath, Shard } from "../Shard.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

describe("WaveActionLogBuilder", () => {
    it("should aggregate tick mismatches per-link", () => {
        const wave = { start: 1000, end: 2000, shardsActions: [{ action: "jump", time: 1500 }] };
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

        const windows = WaveActionLogBuilder.buildShardActionWindows(wave, shards, {}, siteShardPaths, {}, {}, timeline);

        // 3 shards jumped, but 2 were on link "1-2" and 1 was on link "3-4".
        // The number of mismatches should be 2.
        expect(windows[0]!.factionBreakdowns!.ENL!.linkAlignmentMismatches).toBe(2);
    });
});
