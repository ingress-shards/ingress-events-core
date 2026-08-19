import { describe, it, expect } from "vitest";
import { ShardPathBuilder } from "./ShardPathBuilder.js";
import type { ShardPath } from "../Shard.js";

describe("ShardPathBuilder", () => {
    it("should aggregate countLinkAlignmentMismatches per link correctly", () => {
        const pathsRecord: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1200,
                        team: "RES",
                        moves: [
                            { origin: 1, dest: 2, shardId: 101, moveTime: 1250, mismatch: true, scoredRules: ["rule1"] },
                            { origin: 1, dest: 2, shardId: 102, moveTime: 1250, mismatch: true, scoredRules: ["rule1"] }
                        ]
                    },
                    {
                        linkTime: 1300,
                        team: "ENL",
                        moves: [
                            { origin: 1, dest: 2, shardId: 103, moveTime: 1350, mismatch: true, scoredRules: [] }, // Failed scoring
                        ]
                    }
                ]
            }
        };

        const mismatchCount = ShardPathBuilder.countLinkAlignmentMismatches(pathsRecord);
        // The first link has 2 mismatched scored moves -> counts as 1
        // The second link has 1 mismatched UNscored move -> counts as 0
        expect(mismatchCount).toBe(1);
    });
});
