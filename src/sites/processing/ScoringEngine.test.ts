import { describe, it, expect } from "vitest";
import { ScoringEngine } from "./ScoringEngine.js";
import type { ShardPath } from "../Shard.js";
import type { ShardScoringRule } from "../../types/index.js";
import type { ObservedPortal } from "../Portal.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

describe("ScoringEngine", () => {
    const timeline: EventTimeline = {
        start: 1000,
        preEventCutoff: 500,
        end: 5000,
        shards: [
            {
                waveNumber: 1,
                start: 1000,
                end: 2000,
            },
            {
                waveNumber: 2,
                start: 2000,
                end: 3000,
            }
        ],
        targets: [
            {
                waveNumber: 1,
                start: 1000,
                end: 3000,
            }
        ]
    };

    const rules: Record<string, ShardScoringRule> = {
        "Jumps": {
            label: "Jumps",
            tooltip: "Basic jump score",
            points: 1,
            scoreType: "jumps"
        },
        "Zone Jump": {
            label: "Zone Jump",
            tooltip: "Jump exceeding 500m on zone portal",
            points: 2,
            conditions: {
                minDistance: 500,
                ornaments: ["zone_ornament"]
            },
            scoreType: "jumps"
        },
        "Target Jump": {
            label: "Target Jump",
            tooltip: "Jump to target portal",
            points: 5,
            conditions: {
                isTarget: true
            },
            maxScoringShardsPerPortal: 2,
            teamAttribution: "TARGET_OWNER",
            scoreType: "goals"
        }
    };

    it("should score basic moves and default to link creator team", () => {
        const shardPaths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1200,
                        team: "RES",
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 101,
                                moveTime: 1250,
                                points: 0
                            }
                        ]
                    }
                ]
            }
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: { title: "Portal 2", latE6: 0, lngE6: 0 }
        };

        const result = ScoringEngine.scoreShardPaths(shardPaths, rules, portals, timeline);

        // Basic move matches "Jumps" (points = 1)
        expect(result.total.RES).toBe(1);
        expect(result.total.ENL).toBeUndefined();
        expect(result.jumps.summary.RES).toBe(1);
        expect(result.jumps.detail.Jumps).toEqual({ RES: 1 });
        expect(result.goals.summary).toEqual({});
        expect(shardPaths["1-2"]!.links[0]!.moves[0]!.points).toBe(1);
    });

    it("should evaluate conditions like minDistance and ornaments correctly", () => {
        const shardPaths: Record<string, ShardPath> = {
            "1-2": {
                distance: 600, // exceeds minDistance 500
                links: [
                    {
                        linkTime: 1200,
                        team: "ENL",
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 101,
                                moveTime: 1250,
                                points: 0
                            }
                        ]
                    }
                ]
            }
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: {
                title: "Portal 2",
                latE6: 0,
                lngE6: 0,
                history: [
                    {
                        type: "pre-event",
                        timestamp: 400,
                        ornId: "zone_ornament"
                    }
                ]
            }
        };

        const result = ScoringEngine.scoreShardPaths(shardPaths, rules, portals, timeline);

        // Matches both rules: Jumps (1) + Zone Jump (2) = 3 ENL
        expect(result.total.ENL).toBe(3);
        expect(result.total.RES).toBeUndefined();
        expect(result.jumps.summary.ENL).toBe(3);
        expect(result.jumps.detail.Jumps).toEqual({ ENL: 1 });
        expect(result.jumps.detail["Zone Jump"]).toEqual({ ENL: 2 });
        expect(shardPaths["1-2"]!.links[0]!.moves[0]!.points).toBe(3);
    });

    it("should score target jumps, attribute to target owner, and cap max scoring shards per portal", () => {
        const shardPaths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1200,
                        team: "RES", // link team is RES, but target rule says TARGET_OWNER
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 101, // First shard to land
                                moveTime: 1250,
                                points: 0
                            },
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 102, // Second shard to land
                                moveTime: 1300,
                                points: 0
                            },
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 103, // Third shard to land (should be capped since max is 2)
                                moveTime: 1350,
                                points: 0
                            }
                        ]
                    }
                ]
            }
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: {
                title: "Portal 2",
                latE6: 0,
                lngE6: 0,
                history: [
                    {
                        type: "target",
                        timestamp: 1000,
                        ornId: "targetenl" // Target belongs to ENL
                    }
                ]
            }
        };

        const result = ScoringEngine.scoreShardPaths(shardPaths, rules, portals, timeline);

        // First two moves score under default jump (1 RES each) + target rule (5 ENL each -> 10 ENL total)
        // Third move is capped under target, so it only scores default jump (1 RES)
        // Total ENL = 10, Total RES = 3
        expect(result.total.ENL).toBe(10);
        expect(result.total.RES).toBe(3);

        expect(result.jumps.summary.RES).toBe(3);
        expect(result.jumps.detail.Jumps).toEqual({ RES: 3 });

        expect(result.goals.summary.ENL).toBe(10);
        expect(result.goals.detail["Target Jump"]).toEqual({ ENL: 10 });

        expect(shardPaths["1-2"]!.links[0]!.moves[0]!.points).toBe(6); // 1 + 5
        expect(shardPaths["1-2"]!.links[0]!.moves[1]!.points).toBe(6); // 1 + 5
        expect(shardPaths["1-2"]!.links[0]!.moves[2]!.points).toBe(1); // 1 (capped target)
    });

    it("should throw an error if target check is run without a target timeline", () => {
        const shardPaths: Record<string, ShardPath> = {
            "1-2": {
                distance: 100,
                links: [
                    {
                        linkTime: 1200,
                        team: "RES",
                        moves: [
                            {
                                origin: 1,
                                dest: 2,
                                shardId: 101,
                                moveTime: 1250,
                                points: 0
                            }
                        ]
                    }
                ]
            }
        };

        const portals: Record<number, ObservedPortal> = {
            1: { title: "Portal 1", latE6: 0, lngE6: 0 },
            2: { title: "Portal 2", latE6: 0, lngE6: 0 }
        };

        const badTimeline: EventTimeline = {
            start: 1000,
            preEventCutoff: 500,
            end: 5000,
            shards: [
                {
                    waveNumber: 1,
                    start: 1000,
                    end: 2000,
                }
            ]
            // missing targets
        };

        expect(() => {
            ScoringEngine.scoreShardPaths(shardPaths, rules, portals, badTimeline);
        }).toThrow("Target timeline is required for rules with isTarget condition");
    });
});
