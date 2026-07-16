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
                        { eventType: "ANOMALY", startTime: "12:00" }
                    ]
                }
            ]
        },
        seasonGeocode: geocode
    });

    test("should parse fragment jumps correctly", () => {
        const input: ShardJumpCapture = {
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
        expect(shard.shardNumber).toBe(1);
        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[0]!.moveTime).toBe(1000);
        expect(shard.history[0]!.portalId).toBe(1);
    });

    test("should parse no move history entries by tracking last known location", () => {
        const input: ShardJumpCapture = {
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
});
