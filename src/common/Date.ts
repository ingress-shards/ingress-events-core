import {
    blank as durationBlank,
    fromFields as durationFromFields,
    round as durationRound,
    toLocaleString as durationToLocaleString,
} from "temporal-polyfill/fns/Duration";
import {
    fromEpochMilliseconds as instantFromEpochMilliseconds,
    fromString as instantFromString,
    toZonedDateTimeISO as instantToZonedDateTimeISO,
} from "temporal-polyfill/fns/Instant";
import {
    fromString as zdtFromString,
    toLocaleString as zdtToLocaleString,
    withTimeZone as zdtWithTimeZone,
    type Record as ZonedDateTimeRecord,
} from "temporal-polyfill/fns/ZonedDateTime";
import { getBasic } from "temporal-polyfill/fns/Calendar";
import { resolveLocale } from "./Locale.js";

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

/**
 * Standard expected maximum duration of a shard jump window in milliseconds (1 minute).
 * Jump windows exceeding this duration are classified as extended jump windows.
 */
export const STANDARD_JUMP_WINDOW_DURATION_MS = MS_PER_MINUTE;

/**
 * Normalizes an epoch millisecond timestamp or ISO 8601 string into a ZonedDateTimeRecord in the target timezone.
 */
export const toZonedDateTime = (input: number | string, timeZone = "UTC"): ZonedDateTimeRecord => {
    if (typeof input === "number") {
        return instantToZonedDateTimeISO(instantFromEpochMilliseconds(input), timeZone);
    }
    return zdtWithTimeZone(zdtFromString(input, getBasic), timeZone);
};

/**
 * Formats an epoch millisecond timestamp or ISO string into a locale-aware short date.
 */
export const formatDate = (input: number | string, timeZone = "UTC", locale?: string): string => {
    return zdtToLocaleString(toZonedDateTime(input, timeZone), resolveLocale(locale), {
        dateStyle: "short",
    });
};

/**
 * Formats an epoch millisecond timestamp or ISO string into a locale-aware time string.
 * When `includeMs` is true, includes seconds and milliseconds (HH:mm:ss.SSS).
 */
export const formatTime = (
    input: number | string,
    timeZone = "UTC",
    shouldIncludeMs = false,
    locale?: string,
): string => {
    const options: Intl.DateTimeFormatOptions = shouldIncludeMs
        ? { hour: "numeric", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }
        : { hour: "numeric", minute: "2-digit" };
    return zdtToLocaleString(toZonedDateTime(input, timeZone), resolveLocale(locale), options);
};

/**
 * Formats the duration between two epoch millisecond timestamps using Temporal Duration rounding and locale formatting.
 */
export const formatDuration = (
    fromMs: number,
    toMs: number,
    style: "narrow" | "short" | "long" = "narrow",
    smallestUnit: "minutes" | "seconds" = "minutes",
    locale?: string,
): string => {
    const duration = durationRound(
        durationFromFields({ milliseconds: Math.max(0, toMs - fromMs) }),
        { largestUnit: "days", smallestUnit, roundingMode: "halfExpand" },
    );
    const displayOptions = durationBlank(duration)
        ? { style, [`${smallestUnit}Display`]: "always" }
        : { style };
    return durationToLocaleString(
        duration,
        resolveLocale(locale),
        displayOptions as Intl.DateTimeFormatOptions,
    );
};

/**
 * Parses a timestamp (epoch ms) from a filename, checking for either a 10-13 digit epoch value
 * or a YYYY.MM.DD.HH.mm.ss date format. Returns undefined if no pattern is found.
 */
export const parseTimestampFromFilename = (filename: string): number | undefined => {
    const epochMatch = /\b\d{10,13}\b/.exec(filename);
    if (epochMatch) {
        let value = Number(epochMatch[0]);
        if (epochMatch[0].length === 10) value *= MS_PER_SECOND;
        return value;
    }

    const dateMatch = /(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})/.exec(filename);
    if (dateMatch) {
        try {
            const [, y, m, d, h, min, s] = dateMatch;
            const parsedInstant = instantFromString(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
            return parsedInstant.epochMilliseconds;
        } catch {
            return undefined;
        }
    }

    return undefined;
};
