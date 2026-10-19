import { describe, it, expect } from "vitest";
import { getOrnamentIdsByTag, type EventBlueprints } from "./EventBlueprints.js";

describe("EventBlueprints", () => {
    const mockBlueprints: EventBlueprints = {
        events: {
            ANOMALY: { label: "Anomaly" },
            SKIRMISH: { label: "Shard Skirmish" },
            INVESTIGATION: { label: "Shard Investigation" },
            SINGULAR: { label: "Shard Singular" },
            STORM: { label: "Shard Storm" },
            SINGLE_SHARD: { label: "Single Shard" },
            MULTIPLE_SHARDS: { label: "Multiple Shards" },
            UNKNOWN: { label: "Unknown" },
        },
        ornaments: {
            ap1: { label: "Ornament 1", tags: ["pre-event", "battle-beacon"], style: { color: "#F58634" } },
            ap2: { label: "Ornament 2", tags: ["pre-event"], style: { color: "#FF32F7" } },
            targetres: { label: "RES Target", tags: ["target"], style: { icon: "res.png" } },
            targetenl: { label: "ENL Target", tags: ["target"], style: { icon: "enl.png" } },
        },
        shardMechanics: {},
        targetMechanics: {},
    };

    describe("getOrnamentIdsByTag", () => {
        it("returns all IDs matching 'pre-event'", () => {
            const ids = getOrnamentIdsByTag(mockBlueprints, "pre-event");
            expect(ids).toEqual(["ap1", "ap2"]);
        });

        it("returns all IDs matching 'target'", () => {
            const ids = getOrnamentIdsByTag(mockBlueprints, "target");
            expect(ids).toEqual(["targetres", "targetenl"]);
        });

        it("returns empty array when no ornaments match tag", () => {
            const ids = getOrnamentIdsByTag(mockBlueprints, "recursive");
            expect(ids).toEqual([]);
        });
    });
});
