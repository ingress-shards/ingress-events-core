import { describe, test, expect } from "vitest";
import { ShardJumpCaptureAdapter } from "./ShardJumpCaptureAdapter.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";
import type { ShardJumpCapture } from "../../capture/ShardJumps.js";

describe("ShardJumpCaptureAdapter", () => {
    const adapter = new ShardJumpCaptureAdapter();

    const activeSites = [
        {
            id: "test-site",
            name: "Test Site",
            latE6: 10000000,
            lngE6: 20000000,
            eventType: "ANOMALY" as const,
            startTime: "2026-06-18T12:00:00Z[UTC]",
            timeZone: "UTC",
            countryCode: "US"
        },
        {
            id: "helsinki",
            name: "Helsinki, Finland",
            latE6: 60169856,
            lngE6: 24938379,
            eventType: "ANOMALY" as const,
            startTime: "2026-07-18T12:00:00Z[UTC]",
            timeZone: "UTC",
            countryCode: "FI"
        }
    ];

    const geocode = {
        seasons: [
            {
                id: "test-season",
                sites: activeSites
            }
        ]
    };

    const mockRegistry = new EventConfigRegistry({
        eventBlueprints: {
            events: { "ANOMALY": { label: "Anomaly" } },
            ornaments: {},
            shardMechanics: {},
            targetMechanics: {},
            scoring: {}
        } as any,
        seasonManifest: {
            seasons: [
                {
                    id: "test-season",
                    name: "Test Season",
                    year: 2026,
                    overviewUrl: "",
                    components: [
                        {
                            eventType: "ANOMALY",
                            startTime: "12:00",
                            mechanics: {
                                shards: {
                                    shardMechanics: "test-shard-mech",
                                    scoring: {
                                        rules: ["default_jump"],
                                        wavePointAggregation: [[1, 2, 3, 4, 5, 6]]
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        },
        seasonGeocode: geocode
    });

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

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        console.log("--- ShardJumpCaptureAdapter Input ---");
        console.log(JSON.stringify(input, undefined, 2));
        console.log("--- ShardJumpCaptureAdapter Output ---");
        console.log(JSON.stringify(result, undefined, 2));

        expect(result.length).toBe(1);
        const record = result[0]!;
        expect(record.metadata.siteId).toBe("test-site");
        expect(record.metadata.seasonId).toBe("test-season");

        const obs = record.observations!;
        expect(obs.shards).toBeDefined();

        const shard = obs.shards![1]!;
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

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        expect(result.length).toBe(1);

        const record = result[0]!;
        const obs = record.observations!;
        const shard = obs.shards![1]!;
        
        expect(shard.history).toHaveLength(2);
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[1]!.action).toBe("no move");
        expect(shard.history[1]!.portalId).toBe(shard.history[0]!.portalId);
        expect(shard.history[1]!.team).toBeUndefined();
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

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        expect(result.length).toBe(1);

        const record = result[0]!;
        const obs = record.observations!;
        const shard = obs.shards![1]!;
        
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

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        expect(result).toHaveLength(1);
        const record = result[0]!;
        expect(record.metadata.siteId).toBe("helsinki");

        const shard = record.observations!.shards![32]!;
        expect(shard).toBeDefined();
        expect(shard.history).toHaveLength(6);

        // spawn
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[0]!.team).toBe("RES");

        // no move
        expect(shard.history[1]!.action).toBe("no move");
        expect(shard.history[1]!.team).toBeUndefined();

        // no move
        expect(shard.history[2]!.action).toBe("no move");
        expect(shard.history[2]!.team).toBeUndefined();

        // link 1 (RES)
        expect(shard.history[3]!.action).toBe("link");
        expect(shard.history[3]!.team).toBe("RES");

        // link 2 (ENL)
        expect(shard.history[4]!.action).toBe("link");
        expect(shard.history[4]!.team).toBe("ENL");

        // despawn (RES)
        expect(shard.history[5]!.action).toBe("despawn");
        expect(shard.history[5]!.team).toBe("RES");
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

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        expect(result.length).toBe(1);
        const record = result[0]!;
        expect(record.metadata.siteId).toBe("test-site");
        expect(record.metadata.seasonId).toBe("test-season");

        const obs = record.observations!;
        expect(obs.portals).toBeDefined();
        const portal = Object.values(obs.portals!)[0]!;
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

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        expect(result.length).toBe(1);
        const shard = result[0]!.observations!.shards![99]!;
        expect(shard.history[1]!.action).toBe("link");
        expect(shard.history[1]!.mismatch).toBe(true);
    });
});
