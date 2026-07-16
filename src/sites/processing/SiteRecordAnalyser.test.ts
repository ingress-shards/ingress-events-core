import { describe, it, expect } from "vitest";
import { SiteRecordAnalyzer } from "./SiteRecordAnalyzer.js";
import type { SiteRecord } from "../Site.js";
import type { SiteGeocode } from "../../types/config/Geocode.js";
import type { SeasonEvent } from "../../seasons/Season.js";

const mockGeocode: SiteGeocode = {
    id: "test-site",
    name: "Test Site",
    latE6: 10,
    lngE6: 20,
    eventType: "ANOMALY" as SeasonEvent,
    startTime: "2026-07-11T13:00:00Z",
    timeZone: "Europe/London",
    countryCode: "GB"
};

describe("SiteRecordAnalyzer", () => {
    it("should handle record with no observations", () => {
        const record: SiteRecord = {
            lastUpdated: 1000,
            metadata: {
                geocode: mockGeocode,
                schedule: {},
            },
        };

        const analysis = SiteRecordAnalyzer.analyze(record);
        expect(analysis.centroid).toBeUndefined();
        expect(analysis.siteState.counters.shards.moving).toBe(0);
        expect(analysis.siteState.counters.shards.nonMoving).toBe(0);
        expect(analysis.siteState.counters.links).toBe(0);
    });

    it("should calculate correct centroid and shard/link counters", () => {
        const record: SiteRecord = {
            lastUpdated: 1000,
            metadata: {
                geocode: mockGeocode,
                schedule: {},
            },
            observations: {
                portals: {
                    1: { title: "P1", latE6: 10000000, lngE6: 20000000 },
                    2: { title: "P2", latE6: 20000000, lngE6: 40000000 },
                },
                shards: {
                    101: {
                        shardNumber: 101,
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 1 },
                            { action: "link", moveTime: 2000, portalId: 1, dest: 2 },
                        ],
                    },
                    102: {
                        shardNumber: 102,
                        history: [
                            { action: "spawn", moveTime: 1000, portalId: 2 },
                            { action: "no move", moveTime: 3000, portalId: 2 },
                        ],
                    },
                },
            },
        };

        const analysis = SiteRecordAnalyzer.analyze(record);

        // Centroid calculation: avg(10, 20) = 15, avg(20, 40) = 30
        expect(analysis.centroid).toEqual({ latE6: 15000000, lngE6: 30000000 });

        // Shard counts:
        // Shard 101 moved (action: link) -> moving = 1
        // Shard 102 did not move -> nonMoving = 1
        expect(analysis.siteState.counters.shards.moving).toBe(1);
        expect(analysis.siteState.counters.shards.nonMoving).toBe(1);

        // Links: Shard 101 has 1 link action
        expect(analysis.siteState.counters.links).toBe(1);
    });
});
