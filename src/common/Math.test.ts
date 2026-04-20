import { describe, it, expect } from "vitest";
import { roundToDecimalPlaces, truncateToDecimalPlaces } from "./Math.js";

describe("math utils", () => {
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
