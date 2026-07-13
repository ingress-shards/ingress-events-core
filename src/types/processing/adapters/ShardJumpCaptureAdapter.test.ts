import { describe, test, expect } from "vitest";
import { ShardJumpCaptureAdapter } from "./ShardJumpCaptureAdapter.js";
import type { SiteGeocode } from "../../config/Geocode.js";
import type { ShardJumpCapture } from "../../capture/ShardJumps.js";

describe("ShardJumpCaptureAdapter", () => {
    const adapter = new ShardJumpCaptureAdapter();

    const activeSites: SiteGeocode[] = [
        {
            id: "test-site",
            name: "Test Site",
            latE6: 10000000,
            lngE6: 20000000,
            eventType: "ANOMALY",
            startTime: "2026-06-18T12:00:00Z",
            timeZone: "UTC",
            countryCode: "US"
        }
    ];

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

        const result = adapter.parseAndGroup(input, activeSites);
        console.log("--- ShardJumpCaptureAdapter Input ---");
        console.log(JSON.stringify(input, undefined, 2));
        console.log("--- ShardJumpCaptureAdapter Output ---");
        console.log(JSON.stringify(Object.fromEntries(result), undefined, 2));

        expect(result.has("test-site")).toBe(true);
        const obs = result.get("test-site")!;
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

        const result = adapter.parseAndGroup(input, activeSites);
        const obs = result.get("test-site")!;
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

        const result = adapter.parseAndGroup(input, activeSites);
        const obs = result.get("test-site")!;
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
