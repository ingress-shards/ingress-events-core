import { describe, it, expect } from "vitest";
import { haversineDistance, calculateCentroid, isWithinSiteRange } from "./Geo.js";

describe("geo utils", () => {
    describe("haversineDistance", () => {
        it("should calculate distance between two coordinates correctly", () => {
            const coords1 = { latE6: 38707008, lngE6: -9135640 };
            const coords2 = { latE6: 35223789, lngE6: -80841141 };

            // Expected distance for Lisbon to Charlotte is approx 6214.7 km
            const distance = haversineDistance(coords1, coords2);
            expect(Math.round(distance)).toBe(6214699);
        });

        it("should return 0 for same coordinates", () => {
            const coords = { latE6: 0, lngE6: 0 };
            expect(haversineDistance(coords, coords)).toBe(0);
        });
    });

    describe("calculateCentroid", () => {
        it("should return undefined for empty coordinates", () => {
            expect(calculateCentroid([])).toBeUndefined();
        });

        it("should calculate correct average coordinates", () => {
            const coords = [
                { latE6: 10, lngE6: 20 },
                { latE6: 20, lngE6: 40 },
                { latE6: 30, lngE6: 60 }
            ];
            expect(calculateCentroid(coords)).toEqual({ latE6: 20, lngE6: 40 });
        });

        it("should handle rounding correctly", () => {
            const coords = [
                { latE6: 10, lngE6: 20 },
                { latE6: 11, lngE6: 21 }
            ];
            expect(calculateCentroid(coords)).toEqual({ latE6: 11, lngE6: 21 });
        });
    });

    describe("isWithinSiteRange", () => {
        const siteCenter = { latE6: 51500000, lngE6: -100000 };
        // Point ~15 km away
        const insidePoint = { latE6: 51630000, lngE6: -100000 };
        // Point ~35 km away
        const midpoint = { latE6: 51810000, lngE6: -100000 };
        // Point ~60 km away
        const outsidePoint = { latE6: 52040000, lngE6: -100000 };

        it("should return true for points within default range [0, 25km] and false beyond", () => {
            expect(isWithinSiteRange(siteCenter, siteCenter)).toBe(true);
            expect(isWithinSiteRange(siteCenter, insidePoint)).toBe(true);
            expect(isWithinSiteRange(siteCenter, midpoint)).toBe(false);
            expect(isWithinSiteRange(siteCenter, outsidePoint)).toBe(false);
        });

        it("should respect custom min and max bounds [25km, 50km]", () => {
            expect(isWithinSiteRange(siteCenter, insidePoint, 25000, 50000)).toBe(false);
            expect(isWithinSiteRange(siteCenter, midpoint, 25000, 50000)).toBe(true);
            expect(isWithinSiteRange(siteCenter, outsidePoint, 25000, 50000)).toBe(false);
        });
    });

    describe("findSiteByCoords", () => {
        // London coordinates: lat 51.5074, lng -0.1278 (E6: 51507400, -127800)
        const londonSite = {
            seasonId: "season-2026",
            geocode: {
                id: "site-london",
                name: "London",
                eventType: "SKIRMISH" as const,
                latE6: 51507400,
                lngE6: -127800,
                startTime: "2026-06-01T12:00:00Z[UTC]",
                timeZone: "UTC",
                countryCode: "GB",
            },
            timeline: {
                start: 1777723200000, // 12:00
                preEventCutoff: 1777716000000, // 10:00
                end: 1777725900000, // 12:45
                durationMinutes: 45,
                shards: [],
            },
        };

        const sites = [londonSite];

        it("matches an active event during its timeline", async () => {
            const { findSiteByCoords } = await import("./Geo.js");
            const activeTime = londonSite.timeline.start + 20 * 60 * 1000;
            const match = findSiteByCoords(sites, 51500000, -100000, activeTime);
            expect(match?.geocode.id).toBe("site-london");
        });

        it("matches a recent event within the 60-minute post-event buffer", async () => {
            const { findSiteByCoords } = await import("./Geo.js");
            const recentTime = londonSite.timeline.end + 30 * 60 * 1000;
            const match = findSiteByCoords(sites, 51500000, -100000, recentTime);
            expect(match?.geocode.id).toBe("site-london");
        });

        it("matches an upcoming event when before start time", async () => {
            const { findSiteByCoords } = await import("./Geo.js");
            const upcomingTime = londonSite.timeline.start - 24 * 60 * 60 * 1000;
            const match = findSiteByCoords(sites, 51500000, -100000, upcomingTime);
            expect(match?.geocode.id).toBe("site-london");
        });

        it("returns undefined for coordinates beyond the 25km radius", async () => {
            const { findSiteByCoords } = await import("./Geo.js");
            // ~50km away
            const match = findSiteByCoords(sites, 51810000, -100000, londonSite.timeline.start);
            expect(match).toBeUndefined();
        });

        it("returns undefined when the event is expired beyond the 60-minute buffer", async () => {
            const { findSiteByCoords } = await import("./Geo.js");
            const expiredTime = londonSite.timeline.end + 90 * 60 * 1000;
            const match = findSiteByCoords(sites, 51500000, -100000, expiredTime);
            expect(match).toBeUndefined();
        });
    });
});

