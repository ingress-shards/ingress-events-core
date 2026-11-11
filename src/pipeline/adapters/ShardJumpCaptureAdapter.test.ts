import { describe, test, expect } from "vitest";
import { ShardJumpCaptureAdapter } from "./ShardJumpCaptureAdapter.js";
import type { ShardJumpCapture } from "../../types/observations/ShardJumps.js";
import { createMockConfigRegistry } from "../../../test/fixtures/MockConfigRegistry.js";

describe("ShardJumpCaptureAdapter", () => {
    const mockRegistry = createMockConfigRegistry({
        extraSites: [
            {
                id: "helsinki",
                name: "Helsinki, Finland",
                latE6: 60169856,
                lngE6: 24938379,
                eventType: "ANOMALY",
                startTime: "2026-07-18T12:00:00Z[UTC]",
                timeZone: "UTC",
                countryCode: "FI"
            }
        ]
    });

    const adapter = new ShardJumpCaptureAdapter(mockRegistry.getAllSites());

    test("should parse fragment jumps correctly", () => {
        const input: ShardJumpCapture = {
            timestamp: 1000,
            artifact: [
                {
                    id: "fragment_1",
                    name: "Shard 1",
                    fragment: [
                        {
                            id: "fragment_1",
                            history: [
                                {
                                    reason: "spawn",
                                    moveTimeMs: "1000",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationCapturerTeam: "NEUTRAL",
                                    linkCreatorTeam: "NEUTRAL",
                                    destinationPortalInfo: {
                                        title: "Portal Spawn",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);

        expect(result.length).toBe(1);
        const state = result[0]!;
        expect(state.metadata.siteId).toBe("test-site");
        expect(state.metadata.seasonId).toBe("test-season");

        const telemetry = state.telemetry!;
        expect(telemetry.shards).toBeDefined();

        const shard = telemetry.shards![1]!;
        expect(shard).toBeDefined();
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[0]!.moveTime).toBe(1000);
        expect(shard.history[0]!.portalId).toBe(1);
    });

    test("should parse no move history entries by tracking last known location", () => {
        const input: ShardJumpCapture = {
            timestamp: 1000,
            artifact: [
                {
                    id: "fragment_1",
                    name: "Shard 1",
                    fragment: [
                        {
                            id: "fragment_1",
                            history: [
                                {
                                    reason: "spawn",
                                    moveTimeMs: "1000",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationCapturerTeam: "NEUTRAL",
                                    linkCreatorTeam: "NEUTRAL",
                                    destinationPortalInfo: {
                                        title: "Portal Spawn",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    reason: "no move",
                                    moveTimeMs: "2000",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationCapturerTeam: "NEUTRAL",
                                    linkCreatorTeam: "NEUTRAL"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(1);

        const state = result[0]!;
        const telemetry = state.telemetry!;
        const shard = telemetry.shards![1]!;
        
        expect(shard.history).toHaveLength(2);
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[1]!.action).toBe("no move");
        expect(shard.history[1]!.portalId).toBe(shard.history[0]!.portalId);
        expect(shard.history[1]!.align).toBeUndefined();
    });

    test("should map portalId in no move directly after a link to the destination portal", () => {
        const input: ShardJumpCapture = {
            timestamp: 1000,
            artifact: [
                {
                    id: "fragment_1",
                    name: "Shard 1",
                    fragment: [
                        {
                            id: "fragment_1",
                            history: [
                                {
                                    reason: "spawn",
                                    moveTimeMs: "1000",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationCapturerTeam: "NEUTRAL",
                                    linkCreatorTeam: "NEUTRAL",
                                    destinationPortalInfo: {
                                        title: "Portal Spawn",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    reason: "link",
                                    moveTimeMs: "2000",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationCapturerTeam: "NEUTRAL",
                                    linkCreatorTeam: "NEUTRAL",
                                    originPortalInfo: {
                                        title: "Portal Spawn",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    },
                                    destinationPortalInfo: {
                                        title: "Portal Link Dest",
                                        latE6: 15000000,
                                        lngE6: 25000000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    reason: "no move",
                                    moveTimeMs: "3000",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationCapturerTeam: "NEUTRAL",
                                    linkCreatorTeam: "NEUTRAL"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(1);

        const state = result[0]!;
        const telemetry = state.telemetry!;
        const shard = telemetry.shards![1]!;
        
        expect(shard.history).toHaveLength(3);
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[1]!.action).toBe("link");
        expect(shard.history[2]!.action).toBe("no move");
        
        const destinationPortalId = shard.history[1]!.dest;
        expect(destinationPortalId).toBeDefined();
        expect(shard.history[2]!.portalId).toBe(destinationPortalId);
    });

    test("should parse full shard 32 history correctly with spawn, 2 no moves, 2 links (RES and ENL), and despawn", () => {
        const input: ShardJumpCapture = {
            timestamp: 1000,
            artifact: [
                {
                    id: "abaddon1_32",
                    name: "Shard 32",
                    fragment: [
                        {
                            id: "abaddon1_32",
                            history: [
                                {
                                  "moveTimeMs": "1784375980580",
                                  "reason": "despawn",
                                  "originPortalInfo": {
                                    "title": "Kobolttikanuunan muistolaatta",
                                    "latE6": 60170844,
                                    "lngE6": 24949832,
                                    "team": "RESISTANCE"
                                  },
                                  "originCapturerTeam": "RESISTANCE",
                                  "destinationCapturerTeam": "NEUTRAL",
                                  "linkCreatorTeam": "RESISTANCE"
                                },
                                {
                                  "moveTimeMs": "1784375735042",
                                  "reason": "link",
                                  "originPortalInfo": {
                                    "title": "Kirahvi Giraffen",
                                    "latE6": 60169044,
                                    "lngE6": 24949573,
                                    "team": "ENLIGHTENED"
                                  },
                                  "originCapturerTeam": "ENLIGHTENED",
                                  "destinationPortalInfo": {
                                    "title": "Kobolttikanuunan muistolaatta",
                                    "latE6": 60170844,
                                    "lngE6": 24949832,
                                    "team": "ENLIGHTENED"
                                  },
                                  "destinationCapturerTeam": "ENLIGHTENED",
                                  "linkCreationTimeMs": "1784375661238",
                                  "linkCreatorTeam": "ENLIGHTENED",
                                  "linkOriginatedFromOriginPortal": "ORIGIN_TO_DESTINATION"
                                },
                                {
                                  "moveTimeMs": "1784375468313",
                                  "reason": "link",
                                  "originPortalInfo": {
                                    "title": "Hei vaan / Ilmaiskyyti",
                                    "latE6": 60167705,
                                    "lngE6": 24950008,
                                    "team": "RESISTANCE"
                                  },
                                  "originCapturerTeam": "RESISTANCE",
                                  "destinationPortalInfo": {
                                    "title": "Kirahvi Giraffen",
                                    "latE6": 60169044,
                                    "lngE6": 24949573,
                                    "team": "RESISTANCE"
                                  },
                                  "destinationCapturerTeam": "RESISTANCE",
                                  "linkCreationTimeMs": "1784375206567",
                                  "linkCreatorTeam": "RESISTANCE",
                                  "linkOriginatedFromOriginPortal": "DESTINATION_TO_ORIGIN"
                                },
                                {
                                  "moveTimeMs": "1784375153838",
                                  "reason": "no move",
                                  "originCapturerTeam": "NEUTRAL",
                                  "destinationCapturerTeam": "NEUTRAL",
                                  "linkCreatorTeam": "NEUTRAL"
                                },
                                {
                                  "moveTimeMs": "1784374829924",
                                  "reason": "no move",
                                  "originCapturerTeam": "NEUTRAL",
                                  "destinationCapturerTeam": "NEUTRAL",
                                  "linkCreatorTeam": "NEUTRAL"
                                },
                                {
                                  "moveTimeMs": "1784374342160",
                                  "reason": "spawn",
                                  "originCapturerTeam": "NEUTRAL",
                                  "destinationPortalInfo": {
                                    "title": "Hei vaan / Ilmaiskyyti",
                                    "latE6": 60167705,
                                    "lngE6": 24950008,
                                    "team": "RESISTANCE"
                                  },
                                  "destinationCapturerTeam": "RESISTANCE",
                                  "linkCreatorTeam": "NEUTRAL"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result).toHaveLength(1);
        const state = result[0]!;
        expect(state.metadata.siteId).toBe("helsinki");

        const shard = state.telemetry!.shards![32]!;
        expect(shard).toBeDefined();
        expect(shard.history).toHaveLength(6);

        // spawn
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[0]!.align).toBe("RES");

        // no move
        expect(shard.history[1]!.action).toBe("no move");
        expect(shard.history[1]!.align).toBeUndefined();

        // no move
        expect(shard.history[2]!.action).toBe("no move");
        expect(shard.history[2]!.align).toBeUndefined();

        // link 1 (RES)
        expect(shard.history[3]!.action).toBe("link");
        expect(shard.history[3]!.align).toBe("RES");

        // link 2 (ENL)
        expect(shard.history[4]!.action).toBe("link");
        expect(shard.history[4]!.align).toBe("ENL");

        // despawn (RES)
        expect(shard.history[5]!.action).toBe("despawn");
        expect(shard.history[5]!.align).toBe("RES");
    });

    test("should parse target portals from artifact list correctly", () => {
        const input: ShardJumpCapture = {
            timestamp: 1771243200000, // 2026-06-18T12:00:00Z
            artifact: [
                {
                    id: "targetres",
                    name: "Target RES",
                    target: [
                        {
                            portalInfo: {
                                title: "Target Portal One",
                                latE6: 10000000,
                                lngE6: 20000000,
                                team: "NEUTRAL"
                            },
                            targetAlignment: "RESISTANCE"
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(1);
        const state = result[0]!;
        expect(state.metadata.siteId).toBe("test-site");
        expect(state.metadata.seasonId).toBe("test-season");

        const telemetry = state.telemetry!;
        expect(telemetry.portals).toBeDefined();
        const portal = Object.values(telemetry.portals!)[0]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Target Portal One");
        expect(portal.history).toHaveLength(1);
        expect(portal.history![0]!.type).toBe("target");
        
        const historyEntry = portal.history![0] as any;
        expect(historyEntry.ornId).toBe("targetres");
        expect(historyEntry.timestamp).toBe(1771243200000);
    });

    test("should detect team mismatch correctly on links", () => {
        const input: ShardJumpCapture = {
            timestamp: 1771243200000,
            artifact: [
                {
                    id: "test-artifact",
                    name: "Test Artifact",
                    fragment: [
                        {
                            id: "shard_99",
                            history: [
                                {
                                    moveTimeMs: "1771243200000",
                                    reason: "spawn",
                                    originCapturerTeam: "NEUTRAL",
                                    destinationPortalInfo: {
                                        title: "Portal One",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "ENLIGHTENED"
                                    },
                                    destinationCapturerTeam: "ENLIGHTENED",
                                    linkCreatorTeam: "NEUTRAL"
                                },
                                {
                                    moveTimeMs: "1771243500000",
                                    reason: "link",
                                    originPortalInfo: {
                                        title: "Portal One",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "ENLIGHTENED"
                                    },
                                    originCapturerTeam: "ENLIGHTENED",
                                    destinationPortalInfo: {
                                        title: "Portal Two",
                                        latE6: 10001000,
                                        lngE6: 20001000,
                                        team: "RESISTANCE"
                                    },
                                    destinationCapturerTeam: "RESISTANCE",
                                    linkCreatorTeam: "ENLIGHTENED",
                                    linkCreationTimeMs: "1771243300000"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(1);
        const shard = result[0]!.telemetry!.shards![99]!;
        expect(shard.history[1]!.action).toBe("link");
        expect(shard.history[1]!.mismatch).toEqual({ originAlign: "ENL", destAlign: "RES" });
    });

    test("should flag invalid actions when origin does not match current location", () => {
        const defaultTeams = {
            originCapturerTeam: "NEUTRAL",
            destinationCapturerTeam: "NEUTRAL",
            linkCreatorTeam: "NEUTRAL"
        };

        const input: ShardJumpCapture = {
            timestamp: 1000,
            artifact: [
                {
                    id: "fragment_100",
                    name: "Shard 100",
                    fragment: [
                        {
                            id: "shard_100",
                            history: [
                                {
                                    ...defaultTeams,
                                    moveTimeMs: "1000",
                                    reason: "spawn",
                                    destinationPortalInfo: {
                                        title: "Portal 1",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    ...defaultTeams,
                                    moveTimeMs: "2000",
                                    reason: "link",
                                    originPortalInfo: {
                                        title: "Portal 1",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    },
                                    destinationPortalInfo: {
                                        title: "Portal 2",
                                        latE6: 10001000,
                                        lngE6: 20001000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    ...defaultTeams,
                                    moveTimeMs: "3000",
                                    reason: "link",
                                    originPortalInfo: {
                                        title: "Portal 3 (Teleported without jump)",
                                        latE6: 10003000,
                                        lngE6: 20003000,
                                        team: "NEUTRAL"
                                    },
                                    destinationPortalInfo: {
                                        title: "Portal 4",
                                        latE6: 10004000,
                                        lngE6: 20004000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    ...defaultTeams,
                                    moveTimeMs: "4000",
                                    reason: "link",
                                    originPortalInfo: {
                                        title: "Portal 4",
                                        latE6: 10004000,
                                        lngE6: 20004000,
                                        team: "NEUTRAL"
                                    },
                                    destinationPortalInfo: {
                                        title: "Portal 5",
                                        latE6: 10005000,
                                        lngE6: 20005000,
                                        team: "NEUTRAL"
                                    }
                                },
                                {
                                    ...defaultTeams,
                                    moveTimeMs: "5000",
                                    reason: "despawn",
                                    originPortalInfo: {
                                        title: "Portal 1 (Spawn Portal, stale despawn)",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                        team: "NEUTRAL"
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(1);
        const shard = result[0]!.telemetry!.shards![100]!;
        expect(shard.history).toHaveLength(5);
        expect(shard.history[0]!.invalid).toBeUndefined();
        expect(shard.history[1]!.invalid).toBeUndefined();
        expect(shard.history[2]!.invalid).toBe(true);
        expect(shard.history[3]!.invalid).toBeUndefined();
        expect(shard.history[4]!.invalid).toBe(true);
    });
});
