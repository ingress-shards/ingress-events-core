import { describe, it, expect } from "vitest";
import { haversineDistance, calculateCentroid } from "./Geo.js";

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
});
