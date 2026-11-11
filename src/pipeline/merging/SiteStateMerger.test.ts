import { describe, test, expect } from "vitest";
import { SiteStateMerger } from "./SiteStateMerger.js";
import type { SiteState, SiteTelemetry } from "../../sites/Site.js";
import type { TargetHistoryEntry } from "../../sites/Portal.js";

describe("SiteStateMerger", () => {
    const merger = new SiteStateMerger();

    const baseState: SiteState = {
        metadata: {
            siteId: "test-site",
            seasonId: "test-season",
            lastUpdated: 0,
        },
        telemetry: {
            portals: {
                "1": {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "pre-event", timestamp: 1781868600000, ornId: "pe1" }
                    ]
                }
            },
            shards: {
                "10": {
                    history: [
                        { action: "spawn", moveTime: 1781868600000, portalId: 1 }
                    ]
                }
            }
        }
    };

    test("should merge pre-event ornaments for existing portal", () => {
        const incoming: SiteTelemetry = {
            portals: {
                "1": {
                    title: "Portal One (Updated)",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "pre-event" as const, timestamp: 1781869200000, ornId: "pe2" }
                    ]
                }
            }
        };

        const { state: result } = merger.merge(baseState, incoming);
        const portals = result.telemetry!.portals!;

        const portal1 = portals["1"]!;
        expect(portal1).toBeDefined();
        expect(portal1.title).toBe("Portal One (Updated)");
        expect(portal1.history!.length).toBe(2);
        expect(portal1.history![0]!.timestamp).toBe(1781868600000);
        expect(portal1.history![1]!.timestamp).toBe(1781869200000);
    });

    test("should ignore duplicate portal history entries", () => {
        const incoming: SiteTelemetry = {
            portals: {
                "1": {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "pre-event" as const, timestamp: 1781868600000, ornId: "pe1" }
                    ]
                }
            }
        };

        const { state: result } = merger.merge(baseState, incoming);
        expect(result.telemetry!.portals!["1"]!.history!.length).toBe(1);
    });

    test("should assign sequential IDs for multiple new portals and update coord map", () => {
        const incoming: SiteTelemetry = {
            portals: {
                "1": {
                    title: "Portal Two",
                    latE6: 11000000,
                    lngE6: 21000000,
                    history: [
                        { type: "pre-event" as const, timestamp: 1781868900000, ornId: "pe1" }
                    ]
                },
                "2": {
                    title: "Portal Three",
                    latE6: 12000000,
                    lngE6: 22000000,
                    history: [
                        { type: "pre-event" as const, timestamp: 1781869000000, ornId: "pe2" }
                    ]
                }
            }
        };

        const { state: result } = merger.merge(baseState, incoming);
        const portals = result.telemetry!.portals!;

        const portal2 = portals["2"]!;
        const portal3 = portals["3"]!;

        // Base had portal ID 1. Sequential allocation should assign 2 and 3.
        expect(portal2).toBeDefined();
        expect(portal2.title).toBe("Portal Two");
        expect(portal3).toBeDefined();
        expect(portal3.title).toBe("Portal Three");
    });

    test("should merge multiple shard movements and map portal keys/shards correctly with sequential IDs", () => {
        const incoming: SiteTelemetry = {
            portals: {
                "1": {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: []
                },
                "2": {
                    title: "Portal Two",
                    latE6: 12000000,
                    lngE6: 22000000,
                    history: []
                },
                "3": {
                    title: "Portal Three",
                    latE6: 13000000,
                    lngE6: 23000000,
                    history: []
                }
            },
            shards: {
                "10": {
                    history: [
                        {
                            action: "link" as const,
                            moveTime: 1781870403000,
                            portalId: 1,
                            dest: 2
                        }
                    ]
                },
                "20": {
                    history: [
                        {
                            action: "spawn" as const,
                            moveTime: 1781870402000,
                            portalId: 2
                        },
                        {
                            action: "link" as const,
                            moveTime: 1781870404000,
                            portalId: 2,
                            dest: 3
                        }
                    ]
                }
            }
        };

        const { state: result } = merger.merge(baseState, incoming);
        const shards = result.telemetry!.shards!;

        const shard1 = shards["10"]!;
        const shard2 = shards["20"]!;

        expect(shard1).toBeDefined();
        expect(shard1.history.length).toBe(2);
        expect(shard1.history[0]!.action).toBe("spawn");
        expect(shard1.history[1]!.action).toBe("link");
        expect(shard1.history[1]!.portalId).toBe(1); // base state ID
        expect(shard1.history[1]!.dest).toBe(2); // Newly allocated portal ID 2

        expect(shard2).toBeDefined();
        expect(shard2.history.length).toBe(2);
        expect(shard2.history[0]!.action).toBe("spawn");
        expect(shard2.history[0]!.moveTime).toBe(1781870402000);
        expect(shard2.history[1]!.action).toBe("link");
        expect(shard2.history[1]!.moveTime).toBe(1781870404000);
        expect(shard2.history[1]!.portalId).toBe(2);
        expect(shard2.history[1]!.dest).toBe(3); // Newly allocated portal ID 3
    });

    test("Transition-Based Deduplication Test: ignores identical state but appends changes", () => {
        // Base has Portal 1. Let's add a target ornament to Portal 1 first.
        const targetBase: SiteState = {
            ...baseState,
            telemetry: {
                portals: {
                    "1": {
                        title: "Portal One",
                        latE6: 10000000,
                        lngE6: 20000000,
                        history: [
                            { type: "target" as const, timestamp: 1000 * (12 * 60 * 60 + 5 * 60), ornId: "targetres" }
                        ]
                    }
                }
            },
            metadata: {
                ...baseState.metadata,
            }
        };

        // Incoming scan has same state (targetres) at a later timestamp (+10 mins)
        const duplicateScan = {
            portals: {
                "1": {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "target" as const, timestamp: 1000 * (12 * 60 * 60 + 10 * 60), ornId: "targetres" as const }
                    ]
                }
            }
        };

        const { state: result1 } = merger.merge(targetBase, duplicateScan);
        const portal1 = result1.telemetry!.portals!["1"]!;
        expect(portal1.history!.length).toBe(1); // Ignored duplicate state

        // Incoming scan has new state (targetenl) at a later timestamp (+15 mins)
        const transitionScan = {
            portals: {
                "1": {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "target" as const, timestamp: 1000 * (12 * 60 * 60 + 15 * 60), ornId: "targetenl" as const }
                    ]
                }
            }
        };

        const { state: result2 } = merger.merge(targetBase, transitionScan);
        const portal2 = result2.telemetry!.portals!["1"]!;
        expect(portal2.history!.length).toBe(2); // Recorded transition
        expect((portal2.history![1] as TargetHistoryEntry).ornId).toBe("targetenl");
    });

    test("should merge Helsinki shard 32 history correctly into a new site state", () => {
        const emptyState: SiteState = {
            metadata: {
                siteId: "helsinki",
                seasonId: "test-season",
                lastUpdated: 0,
            },
            telemetry: {
                portals: {},
                shards: {}
            }
        };

        const incoming: SiteTelemetry = {
            portals: {
                "1": { title: "Hei vaan / Ilmaiskyyti", latE6: 60167705, lngE6: 24950008, history: [] },
                "2": { title: "Kirahvi Giraffen", latE6: 60169044, lngE6: 24949573, history: [] },
                "3": { title: "Kobolttikanuunan muistolaatta", latE6: 60170844, lngE6: 24949832, history: [] }
            },
            shards: {
                "32": {
                    history: [
                        { action: "spawn", moveTime: 1784374342160, portalId: 1, align: "RES" },
                        { action: "no move", moveTime: 1784374829924, portalId: 1 },
                        { action: "no move", moveTime: 1784375153838, portalId: 1 },
                        { action: "link", moveTime: 1784375468313, portalId: 1, dest: 2, align: "RES", linkTime: 1784375206567 },
                        { action: "link", moveTime: 1784375735042, portalId: 2, dest: 3, align: "ENL", linkTime: 1784375661238 },
                        { action: "despawn", moveTime: 1784375980580, portalId: 3, align: "RES" }
                    ]
                }
            }
        };

        const { state: result } = merger.merge(emptyState, incoming);
        const shard = result.telemetry!.shards!["32"]!;
        expect(shard).toBeDefined();
        expect(shard.history).toHaveLength(6);

        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[0]!.align).toBe("RES");

        expect(shard.history[1]!.action).toBe("no move");
        expect(shard.history[1]!.align).toBeUndefined();

        expect(shard.history[2]!.action).toBe("no move");
        expect(shard.history[2]!.align).toBeUndefined();

        expect(shard.history[3]!.action).toBe("link");
        expect(shard.history[3]!.align).toBe("RES");

        expect(shard.history[4]!.action).toBe("link");
        expect(shard.history[4]!.align).toBe("ENL");

        expect(shard.history[5]!.action).toBe("despawn");
        expect(shard.history[5]!.align).toBe("RES");
    });

    test("should merge Helsinki shard 32 history correctly into an existing site state with only the spawn history item", () => {
        const existingState: SiteState = {
            metadata: {
                siteId: "helsinki",
                seasonId: "test-season",
                lastUpdated: 0,
            },
            telemetry: {
                portals: {
                    "1": { title: "Hei vaan / Ilmaiskyyti", latE6: 60167705, lngE6: 24950008, history: [] },
                    "2": { title: "Kirahvi Giraffen", latE6: 60169044, lngE6: 24949573, history: [] },
                    "3": { title: "Kobolttikanuunan muistolaatta", latE6: 60170844, lngE6: 24949832, history: [] }
                },
                shards: {
                    "32": {
                        history: [
                            { action: "spawn", moveTime: 1784374342160, portalId: 1, align: "RES" }
                        ]
                    }
                }
            }
        };

        const incoming: SiteTelemetry = {
            portals: {
                "1": { title: "Hei vaan / Ilmaiskyyti", latE6: 60167705, lngE6: 24950008, history: [] },
                "2": { title: "Kirahvi Giraffen", latE6: 60169044, lngE6: 24949573, history: [] },
                "3": { title: "Kobolttikanuunan muistolaatta", latE6: 60170844, lngE6: 24949832, history: [] }
            },
            shards: {
                "32": {
                    history: [
                        { action: "spawn", moveTime: 1784374342160, portalId: 1, align: "RES" },
                        { action: "no move", moveTime: 1784374829924, portalId: 1 },
                        { action: "no move", moveTime: 1784375153838, portalId: 1 },
                        { action: "link", moveTime: 1784375468313, portalId: 1, dest: 2, align: "RES", linkTime: 1784375206567 },
                        { action: "link", moveTime: 1784375735042, portalId: 2, dest: 3, align: "ENL", linkTime: 1784375661238 },
                        { action: "despawn", moveTime: 1784375980580, portalId: 3, align: "RES" }
                    ]
                }
            }
        };

        const { state: result } = merger.merge(existingState, incoming);
        const shard = result.telemetry!.shards!["32"]!;
        expect(shard).toBeDefined();
        expect(shard.history).toHaveLength(6);

        expect(shard.history[0]!.action).toBe("spawn");
        expect(shard.history[0]!.align).toBe("RES");

        expect(shard.history[1]!.action).toBe("no move");
        expect(shard.history[1]!.align).toBeUndefined();

        expect(shard.history[2]!.action).toBe("no move");
        expect(shard.history[2]!.align).toBeUndefined();

        expect(shard.history[3]!.action).toBe("link");
        expect(shard.history[3]!.align).toBe("RES");

        expect(shard.history[4]!.action).toBe("link");
        expect(shard.history[4]!.align).toBe("ENL");

        expect(shard.history[5]!.action).toBe("despawn");
        expect(shard.history[5]!.align).toBe("RES");
    });
});
