import { describe, it, expect } from "vitest";
import { ShardPathBuilder } from "./ShardPathBuilder.js";
import type { Shard } from "../../sites/Shard.js";

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
        expect(paths["1-2"]!.teleports).toBeUndefined();
    });

    it("should build teleport paths exclusively when jump actions occur", () => {
        const builder = new ShardPathBuilder();
        const shards = new Map<number, Shard>([
            [1, {
                history: [
                    { action: "spawn", moveTime: 1000, portalId: 1 },
                    { action: "jump", moveTime: 1300, portalId: 1, dest: 3 }
                ]
            }]
        ]);

        const portals = {
            1: { title: "Portal 1", latE6: 10000000, lngE6: 20000000 },
            3: { title: "Portal 3", latE6: 10002000, lngE6: 20002000 }
        };

        const paths = builder.build(shards, portals);
        expect(paths["1-3"]).toBeDefined();
        expect(paths["1-3"]!.links).toHaveLength(0);
        expect(paths["1-3"]!.teleports).toHaveLength(1);
        expect(paths["1-3"]!.teleports![0]).toEqual({
            origin: 1,
            dest: 3,
            shardId: 1,
            moveTime: 1300
        });
        expect(paths["1-3"]!.distance).toBeGreaterThan(0);
    });
});
