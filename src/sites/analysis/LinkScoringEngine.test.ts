import { describe, it, expect } from "vitest";
import { LinkScoringEngine } from "./LinkScoringEngine.js";
import type { ShardLinkScoringRule } from "../../types/index.js";
import type { Link, ShardMove, ShardPath } from "../Shard.js";
import type { ObservedPortal } from "../Portal.js";
import type { SiteTimeline } from "../../config/SiteConfig.js";

describe("LinkScoringEngine", () => {
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
                expectedShards: 5
            }
        ],
        targets: []
    };

    const rules: Record<string, ShardLinkScoringRule> = {
        "Regular Link": {
            label: "Regular Link",
            points: 1
        },
        "Zone Link": {
            label: "Zone Link",
            points: 2,
            conditions: {
                minDistance: 500,
                ornaments: ["ap1"]
            }
        }
    };

    it("should score a regular link move when conditions match", () => {
        const move: ShardMove = {
            origin: 1,
            dest: 2,
            shardId: 101,
            moveTime: 1250
        };
        const link: Link = {
            linkTime: 1200,
            align: "RES",
            moves: [move]
        };
        const path: ShardPath = {
            distance: 100,
            links: [link]
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: { title: "Portal 2", latE6: 0, lngE6: 0 }
        };

        const engine = new LinkScoringEngine(rules, portals, timeline);
        engine.scorePaths({ "1-2": path });

        // Basic move matches "Regular Link" (points = 1)
        expect(move.scoredRules).toEqual(["Regular Link"]);
    });

    it("should correctly handle link alignment mismatches (opposing faction link)", () => {
        const move: ShardMove = {
            origin: 1,
            dest: 2,
            shardId: 101,
            moveTime: 1250,
            mismatch: true // ENL shard jumping on RES link
        };
        const link: Link = {
            linkTime: 1200,
            align: "RES",
            moves: [move]
        };
        const path: ShardPath = {
            distance: 100,
            links: [link]
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: { title: "Portal 2", latE6: 0, lngE6: 0 }
        };

        const engine = new LinkScoringEngine(rules, portals, timeline);
        engine.scorePaths({ "1-2": path });

        // Mismatched move still scores points for the link owner
        expect(move.scoredRules).toEqual(["Regular Link"]);
    });

    it("should evaluate conditions like minDistance and ornaments correctly", () => {
        const move: ShardMove = {
            origin: 1,
            dest: 2,
            shardId: 101,
            moveTime: 1250
        };
        const link: Link = {
            linkTime: 1200,
            align: "ENL",
            moves: [move]
        };
        const path: ShardPath = {
            distance: 600, // exceeds minDistance 500
            links: [link]
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: {
                title: "Portal 2",
                latE6: 0,
                lngE6: 0,
                history: [
                    { type: "pre-event", timestamp: 500, ornId: "ap1" }
                ]
            }
        };

        const engine = new LinkScoringEngine(rules, portals, timeline);
        engine.scorePaths({ "1-2": path });

        // Both rules match
        expect(move.scoredRules).toEqual(["Regular Link", "Zone Link"]);
    });

    it("should omit scoredRules if minDistance condition fails", () => {
        const move: ShardMove = {
            origin: 1,
            dest: 2,
            shardId: 101,
            moveTime: 1250
        };
        const link: Link = {
            linkTime: 1200,
            align: "ENL",
            moves: [move]
        };
        const path: ShardPath = {
            distance: 499, // fails minDistance 500
            links: [link]
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: {
                title: "Portal 2",
                latE6: 0,
                lngE6: 0,
                history: [
                    { type: "pre-event", timestamp: 500, ornId: "zone_ornament" }
                ]
            }
        };

        const rulesOnlyZone: Record<string, ShardLinkScoringRule> = {
            "Zone Link": rules["Zone Link"]!
        };

        const engine = new LinkScoringEngine(rulesOnlyZone, portals, timeline);
        engine.scorePaths({ "1-2": path });
        expect(move.scoredRules).toBeUndefined();
    });

    it("should score all paths and assign scoredRules to moves in chronological order", () => {
        const move1: ShardMove = { origin: 1, dest: 2, shardId: 101, moveTime: 1250 };
        const move2: ShardMove = { origin: 1, dest: 2, shardId: 102, moveTime: 1300 };
        const paths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [{
                    linkTime: 1200,
                    align: "RES",
                    moves: [move1, move2]
                }]
            }
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: { title: "Portal 2", latE6: 0, lngE6: 0 }
        };

        const engine = new LinkScoringEngine(rules, portals, timeline);
        engine.scorePaths(paths);

        expect(move1.scoredRules).toEqual(["Regular Link"]);
        expect(move2.scoredRules).toEqual(["Regular Link"]);
    });
});
