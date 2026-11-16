import { describe, it, expect } from "vitest";
import { fromString as instantFromString } from "temporal-polyfill/fns/Instant";
import {
    MS_PER_SECOND,
    MS_PER_MINUTE,
    MS_PER_DAY,
    STANDARD_JUMP_WINDOW_DURATION_MS,
    toZonedDateTime,
    formatDate,
    formatTime,
    formatDuration,
    parseTimestampFromFilename,
} from "./Date.js";

describe("Date", () => {
    it("defines standard millisecond constants", () => {
        expect(MS_PER_SECOND).toBe(1000);
        expect(MS_PER_MINUTE).toBe(60_000);
        expect(MS_PER_DAY).toBe(86_400_000);
        expect(STANDARD_JUMP_WINDOW_DURATION_MS).toBe(MS_PER_MINUTE);
    });

    it("normalizes epoch ms and ISO strings to ZonedDateTime", () => {
        const iso = "2026-06-01T12:30:00Z[UTC]";
        const zdtFromStr = toZonedDateTime(iso, "America/New_York");
        expect(zdtFromStr.timeZoneId).toBe("America/New_York");
        expect(zdtFromStr.hour).toBe(8);

        const zdtFromNum = toZonedDateTime(zdtFromStr.epochMilliseconds, "UTC");
        expect(zdtFromNum.hour).toBe(12);
        expect(zdtFromNum.minute).toBe(30);
    });

    it("formats short dates and times", () => {
        const ms = instantFromString("2026-06-01T14:05:09.123Z").epochMilliseconds;
        expect(formatDate(ms, "UTC", "en-GB")).toBe("01/06/2026");
        expect(formatTime(ms, "UTC", false, "en-GB")).toBe("14:05");
        expect(formatTime(ms, "UTC", true, "en-GB")).toBe("14:05:09.123");
    });

    it("formats durations using Temporal Duration rounding and locale formatting", () => {
        const start = 1_700_000_000_000;
        expect(formatDuration(start, start + 90 * MS_PER_MINUTE, "narrow", "minutes", "en-GB")).toBe("1h 30m");
        expect(formatDuration(start, start + 75 * MS_PER_SECOND, "narrow", "seconds", "en-GB")).toBe("1m 15s");
        expect(formatDuration(start, start + 2 * MS_PER_DAY + 3 * 60 * MS_PER_MINUTE, "long", "minutes", "en-GB"))
            .toBe("2 days, 3 hours");
        expect(formatDuration(start + 1000, start, "narrow", "minutes", "en-GB")).toBe("0m");
    });

    it("parses timestamps from filenames", () => {
        expect(parseTimestampFromFilename("shard-jump-times-2026.03.14.07.06.05.json"))
            .toBe(instantFromString("2026-03-14T07:06:05Z").epochMilliseconds);
        expect(parseTimestampFromFilename("capture-1700000000.json")).toBe(1_700_000_000_000);
        expect(parseTimestampFromFilename("capture-1700000000123.json")).toBe(1_700_000_000_123);
        expect(parseTimestampFromFilename("no-timestamp.json")).toBeUndefined();
    });
});
