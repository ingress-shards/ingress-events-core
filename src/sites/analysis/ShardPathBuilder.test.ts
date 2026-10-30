import { describe, it, expect } from "vitest";
import { ShardPathBuilder } from "./ShardPathBuilder.js";
import type { Shard } from "../Shard.js";

describe("ShardPathBuilder", () => {
    it("should build shard paths with distance and chronological link ordering", () => {
        const builder = new ShardPathBuilder();
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "spawn", moveTime: 1000, portalId: 1 },
                    { action: "link", moveTime: 1200, portalId: 1, dest: 2, align: "RES" as const, linkTime: 1100 }
                ]
            }]
        ]);

        const portals = {
            1: { title: "Portal 1", latE6: 10000000, lngE6: 20000000 },
            2: { title: "Portal 2", latE6: 10001000, lngE6: 20001000 }
        };

        const paths = builder.build(shards, portals);
        expect(paths["1-2"]).toBeDefined();
        expect(paths["1-2"]!.links).toHaveLength(1);
        expect(paths["1-2"]!.links[0]!.align).toBe("RES");
        expect(paths["1-2"]!.links[0]!.moves).toHaveLength(1);
        expect(paths["1-2"]!.links[0]!.moves[0]!.shardId).toBe(1);
        expect(paths["1-2"]!.distance).toBeGreaterThan(0);
    });
});
