import { describe, it, expect } from "vitest";
import { haversineDistance, roundToDecimalPlaces, truncateToDecimalPlaces } from "../../src/utils/Math.js";

describe("math utils", () => {
    describe("haversineDistance", () => {
        it("should calculate distance between two coordinates correctly", () => {
            const coords1 = { lat: 38.707008, lng: -9.13564 };
            const coords2 = { lat: 35.223789, lng: -80.841141 };

            // Expected distance for Lisbon to Charlotte is approx 6214.7 km
            const distance = haversineDistance(coords1, coords2);
            expect(Math.round(distance)).toBe(6214699);
        });

        it("should return 0 for same coordinates", () => {
            const coords = { lat: 0, lng: 0 };
            expect(haversineDistance(coords, coords)).toBe(0);
        });
    });

    describe("roundToDecimalPlaces", () => {
        it("should round to specified decimal places", () => {
            expect(roundToDecimalPlaces(1.23456, 2)).toBe(1.23);
            expect(roundToDecimalPlaces(1.23556, 2)).toBe(1.24);
            expect(roundToDecimalPlaces(1.2, 0)).toBe(1);
        });
    });

    describe("truncateToDecimalPlaces", () => {
        it("should truncate to specified decimal places", () => {
            expect(truncateToDecimalPlaces(1.23456, 2)).toBe(1.23);
            expect(truncateToDecimalPlaces(1.23956, 2)).toBe(1.23);
            expect(truncateToDecimalPlaces(1.9, 0)).toBe(1);
        });
    });
});
