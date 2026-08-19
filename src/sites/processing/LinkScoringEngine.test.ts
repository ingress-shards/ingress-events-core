import { describe, it, expect } from "vitest";
import { LinkScoringEngine } from "./LinkScoringEngine.js";
import type { ShardPath, ShardMove, Link } from "../Shard.js";
import type { ShardLinkScoringRule } from "../../types/index.js";
import type { ObservedPortal } from "../Portal.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

describe("LinkScoringEngine", () => {
    const timeline: EventTimeline = {
        start: 1000,
        preEventCutoff: 500,
        end: 5000,
        shards: [
            {
                waveNumber: 1,
                start: 1000,
                end: 2000,
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
                minDistance: 250,
                maxDistance: 5000000,
                ornaments: ["ap1", "ap2"]
            }
        },
        "Cross Zone Link": {
            label: "Cross Zone Link",
            points: 3,
            conditions: {
                minDistance: 5000000,
                ornaments: ["ap1", "ap2"]
            }
        }
    };

    it("should score basic moves and return array of matched rules", () => {
        const move: ShardMove = {
            origin: 1,
            dest: 2,
            shardId: 101,
            moveTime: 1250
        };
        const link: Link = {
            linkTime: 1200,
            team: "RES",
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

        const scorer = LinkScoringEngine.createScorer(rules, portals, timeline);
        const result = scorer(move, link, path);

        // Basic move matches "Regular Link" (points = 1)
        expect(result).toEqual(["Regular Link"]);
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
            team: "RES",
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

        const scorer = LinkScoringEngine.createScorer(rules, portals, timeline);
        const result = scorer(move, link, path);

        // Mismatched move still scores points for the link owner
        expect(result).toEqual(["Regular Link"]);
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
            team: "ENL",
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

        const scorer = LinkScoringEngine.createScorer(rules, portals, timeline);
        const result = scorer(move, link, path);

        // Both rules match
        expect(result).toEqual(["Regular Link", "Zone Link"]);
    });

    it("should return empty array if minDistance condition fails", () => {
        const move: ShardMove = {
            origin: 1,
            dest: 2,
            shardId: 101,
            moveTime: 1250
        };
        const link: Link = {
            linkTime: 1200,
            team: "ENL",
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

        const scorer = LinkScoringEngine.createScorer(rulesOnlyZone, portals, timeline);
        const result = scorer(move, link, path);

        expect(result).toEqual([]);
    });
});
