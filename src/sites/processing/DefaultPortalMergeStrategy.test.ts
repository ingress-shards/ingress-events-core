import { describe, expect, test, vi } from "vitest";
import { DefaultPortalMergeStrategy } from "./DefaultPortalMergeStrategy.js";

const getWaveIndex = (ts: number): number | undefined => {
    if (ts >= 1000 && ts <= 2000) return 0;
    if (ts >= 3000 && ts <= 4000) return 1;
    return undefined;
};

describe("DefaultPortalMergeStrategy", () => {
    const strategy = new DefaultPortalMergeStrategy();

    test("should merge new portals and assign new IDs", () => {
        const coordToPortalIdMap = new Map<string, number>();
        const result = strategy.merge(
            {},
            {
                1: { title: "Portal One", latE6: 10000000, lngE6: 20000000, history: [] },
                2: { title: "Portal Two", latE6: 30000000, lngE6: 40000000, history: [] }
            },
            {
                coordToPortalIdMap,
                nextPortalId: 1
            }
        );

        expect(Object.keys(result.portals)).toHaveLength(2);
        expect(result.portals[1]?.title).toBe("Portal One");
        expect(result.portals[2]?.title).toBe("Portal Two");
        expect(result.nextPortalId).toBe(3);
        expect(result.coordToPortalIdMap.get("10000000_20000000")).toBe(1);
    });

    test("should merge pre-event history entries and deduplicate transitions/timestamps", () => {
        const coordToPortalIdMap = new Map<string, number>([
            ["10000000_20000000", 1]
        ]);

        const result = strategy.merge(
            {
                1: {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "pre-event", timestamp: 1000, ornId: "ap1" }
                    ]
                }
            },
            {
                1: {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        // Duplicate timestamp: should ignore
                        { type: "pre-event", timestamp: 1000, ornId: "ap1" },
                        // Duplicate transition (same ornament ID): should ignore
                        { type: "pre-event", timestamp: 2000, ornId: "ap1" },
                        // Valid transition to new ornament ID: should append
                        { type: "pre-event", timestamp: 3000, ornId: "ap2" }
                    ]
                }
            },
            {
                coordToPortalIdMap,
                nextPortalId: 2
            }
        );

        expect(result.portals[1]?.history).toEqual([
            { type: "pre-event", timestamp: 1000, ornId: "ap1" },
            { type: "pre-event", timestamp: 3000, ornId: "ap2" }
        ]);
    });

    test("should merge live history entries and apply transition checks", () => {
        const coordToPortalIdMap = new Map<string, number>([
            ["10000000_20000000", 1],
            ["30000000_40000000", 2]
        ]);

        const result = strategy.merge(
            {
                1: {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "target", timestamp: 1000, ornId: "targetres" }
                    ]
                },
                2: {
                    title: "Portal Two",
                    latE6: 30000000,
                    lngE6: 40000000,
                    history: [
                        { type: "battle-beacon", timestamp: 1000, ornId: "bb_s" }
                    ]
                }
            },
            {
                1: {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        // Duplicate transition for target
                        { type: "target", timestamp: 2000, ornId: "targetres" },
                        // Valid transition for target
                        { type: "target", timestamp: 3000, ornId: "targetenl" }
                    ]
                },
                2: {
                    title: "Portal Two",
                    latE6: 30000000,
                    lngE6: 40000000,
                    history: [
                        // Duplicate transition for battle-beacon
                        { type: "battle-beacon", timestamp: 2000, ornId: "bb_s" },
                        // Valid transition for battle-beacon
                        { type: "battle-beacon", timestamp: 3000, ornId: "peBB_BATTLE" }
                    ]
                }
            },
            {
                coordToPortalIdMap,
                nextPortalId: 3
            }
        );

        expect(result.portals[1]?.history).toEqual([
            { type: "target", timestamp: 1000, ornId: "targetres" },
            { type: "target", timestamp: 3000, ornId: "targetenl" }
        ]);

        expect(result.portals[2]?.history).toEqual([
            { type: "battle-beacon", timestamp: 1000, ornId: "bb_s" },
            { type: "battle-beacon", timestamp: 3000, ornId: "peBB_BATTLE" }
        ]);
    });

    test("should warn if portal count and map size have inconsistency", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { void 0; });
        const coordToPortalIdMap = new Map<string, number>([
            ["10000000_20000000", 1]
        ]);

        strategy.merge(
            {
                1: { title: "Portal One", latE6: 10000000, lngE6: 20000000, history: [] },
                2: { title: "Portal Two", latE6: 30000000, lngE6: 40000000, history: [] }
            },
            {},
            {
                coordToPortalIdMap,
                nextPortalId: 3
            }
        );

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Consistency mismatch")
        );
        warnSpy.mockRestore();
    });


    test("should deduplicate targets by wave period when getWaveIndex is provided", () => {
        const coordToPortalIdMap = new Map<string, number>([
            ["10000000_20000000", 1]
        ]);

        const result = strategy.merge(
            {
                1: {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        { type: "target", timestamp: 1200, ornId: "targetres" }
                    ]
                }
            },
            {
                1: {
                    title: "Portal One",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: [
                        // Duplicate wave (Wave 1): should ignore
                        { type: "target", timestamp: 1500, ornId: "targetres" },
                        // New wave (Wave 2): should accept
                        { type: "target", timestamp: 3500, ornId: "targetres" }
                    ]
                }
            },
            {
                coordToPortalIdMap,
                nextPortalId: 2,
                getWaveIndex
            }
        );

        expect(result.portals[1]?.history).toEqual([
            { type: "target", timestamp: 1200, ornId: "targetres" },
            { type: "target", timestamp: 3500, ornId: "targetres" }
        ]);
    });
});
