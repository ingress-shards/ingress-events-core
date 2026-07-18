import { describe, test, expect } from "vitest";
import { SiteRecordMerger } from "./SiteRecordMerger.js";
import type { SiteRecord, SiteObservation } from "../Site.js";
import type { TargetHistoryEntry } from "../Portal.js";

describe("SiteRecordMerger", () => {
    const merger = new SiteRecordMerger();

    const baseRecord: SiteRecord = {
        metadata: {
            siteId: "test-site",
            seasonId: "test-season",
            lastUpdated: 0,
        },
        observations: {
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
        const incoming: SiteObservation = {
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

        const { record: result } = merger.merge(baseRecord, incoming);
        const portals = result.observations!.portals!;

        const portal1 = portals["1"]!;
        expect(portal1).toBeDefined();
        expect(portal1.title).toBe("Portal One (Updated)");
        expect(portal1.history!.length).toBe(2);
        expect(portal1.history![0]!.timestamp).toBe(1781868600000);
        expect(portal1.history![1]!.timestamp).toBe(1781869200000);
    });

    test("should ignore duplicate portal history entries", () => {
        const incoming: SiteObservation = {
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

        const { record: result } = merger.merge(baseRecord, incoming);
        expect(result.observations!.portals!["1"]!.history!.length).toBe(1);
    });

    test("should assign sequential IDs for multiple new portals and update coord map", () => {
        const incoming: SiteObservation = {
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

        const { record: result } = merger.merge(baseRecord, incoming);
        const portals = result.observations!.portals!;

        const portal2 = portals["2"]!;
        const portal3 = portals["3"]!;

        // Base had portal ID 1. Sequential allocation should assign 2 and 3.
        expect(portal2).toBeDefined();
        expect(portal2.title).toBe("Portal Two");
        expect(portal3).toBeDefined();
        expect(portal3.title).toBe("Portal Three");
    });

    test("should merge multiple shard movements and map portal keys/shards correctly with sequential IDs", () => {
        const incoming: SiteObservation = {
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

        const { record: result } = merger.merge(baseRecord, incoming);
        const shards = result.observations!.shards!;

        const shard1 = shards["10"]!;
        const shard2 = shards["20"]!;

        expect(shard1).toBeDefined();
        expect(shard1.history.length).toBe(2);
        expect(shard1.history[0]!.action).toBe("spawn");
        expect(shard1.history[1]!.action).toBe("link");
        expect(shard1.history[1]!.portalId).toBe(1); // base record ID
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
        const targetBase: SiteRecord = {
            ...baseRecord,
            observations: {
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
                ...baseRecord.metadata,
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

        const { record: result1 } = merger.merge(targetBase, duplicateScan);
        const portal1 = result1.observations!.portals!["1"]!;
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

        const { record: result2 } = merger.merge(targetBase, transitionScan);
        const portal2 = result2.observations!.portals!["1"]!;
        expect(portal2.history!.length).toBe(2); // Recorded transition
        expect((portal2.history![1] as TargetHistoryEntry).ornId).toBe("targetenl");
    });
});
