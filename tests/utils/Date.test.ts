import { describe, it, expect } from "vitest";
import {
    convertMsEpochToSecEpoch,
    formatEpochToSerializationString,
    createWaveDate,
    isWithin24Hours,
} from "../../src/utils/Date.js";

describe("date utils", () => {
    describe("convertMsEpochToSecEpoch", () => {
        it("should convert milliseconds to seconds and truncate", () => {
            // 1672531200500 ms -> 1672531200 s
            expect(convertMsEpochToSecEpoch(1672531200500)).toBe(1672531200);
        });
    });

    describe("formatEpochToSerializationString", () => {
        it("should format epoch to ISO string without milliseconds", () => {
            // 2023-01-01T00:00:00.000Z = 1672531200000
            expect(formatEpochToSerializationString(1672531200000)).toBe("2023-01-01T00:00:00");
        });
    });

    describe("isWithin24Hours", () => {
        it("should return true for times within 24 hours", () => {
            const start = 1672531200000;
            const end = start + 24 * 60 * 60 * 1000;
            expect(isWithin24Hours(end, start)).toBe(true);
        });

        it("should return false for times outside 24 hours", () => {
            const start = 1672531200000;
            const end = start + 24 * 60 * 60 * 1000 + 1;
            expect(isWithin24Hours(end, start)).toBe(false);
        });
    });

    describe("createWaveDate", () => {
        it("should correctly set time in specific timezone", () => {
            // 2023-10-10T10:00:00Z
            const siteDateIso = "2023-10-10T10:00:00Z";
            const siteTimezone = "America/New_York"; // UTC-4 in Oct
            const timeStr = "14:30";

            // Target: 2023-10-10 14:30:00 America/New_York
            // 14:30 NY = 18:30 UTC
            const result = createWaveDate(siteDateIso, siteTimezone, timeStr);

            expect(result.toISOString()).toBe("2023-10-10T18:30:00.000Z");
        });

        it("should handle timezone crossing midnight UTC", () => {
            const siteDateIso = "2023-10-10T10:00:00Z";
            const siteTimezone = "Asia/Tokyo"; // UTC+9
            const timeStr = "09:00";

            // Target: 2023-10-10 09:00:00 Tokyo
            // 09:00 Tokyo = 00:00 UTC same day
            const result = createWaveDate(siteDateIso, siteTimezone, timeStr);

            expect(result.toISOString()).toBe("2023-10-10T00:00:00.000Z");
        });
    });
});
