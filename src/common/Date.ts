import type { Temporal } from "temporal-polyfill";
import { fromString as instantFromString, epochMilliseconds as instantEpochMilliseconds } from "temporal-polyfill/fns/instant";

/**
 * Formats a Temporal.Duration into a human-readable string (e.g., 1d 4h 30m).
 */
export const formatDuration = (d: Temporal.DurationLike, includeSeconds = false): string => {
    const { days = 0, hours = 0, minutes = 0, seconds = 0 } = d;

    if (days === 0 && hours === 0 && minutes === 0 && (!includeSeconds || seconds === 0)) {
        return includeSeconds ? "< 1s" : "< 1m";
    }

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (includeSeconds && (seconds > 0 || (days === 0 && hours === 0 && minutes === 0))) {
        parts.push(`${seconds}s`);
    }

    return parts.join(" ");
};

/**
 * Parses a timestamp (epoch ms) from a filename, checking for either a 10-13 digit epoch value
 * or a YYYY.MM.DD.HH.mm.ss date format. Returns undefined if no pattern is found.
 */
export const parseTimestampFromFilename = (filename: string): number | undefined => {
    const epochMatch = /\b\d{10,13}\b/.exec(filename);
    if (epochMatch) {
        let value = parseInt(epochMatch[0], 10);
        if (epochMatch[0].length === 10) value *= 1000;
        return value;
    }

    const dateMatch = /(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})/.exec(filename);
    if (dateMatch) {
        try {
            const [, y, m, d, h, min, s] = dateMatch;
            const parsedInstant = instantFromString(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
            return instantEpochMilliseconds(parsedInstant);
        } catch {
            return undefined;
        }
    }

    return undefined;
};
