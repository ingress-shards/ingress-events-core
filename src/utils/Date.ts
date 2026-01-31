import { Temporal } from "temporal-polyfill";

// Default locale, safely checking for the browser's navigator object.
const DEFAULT_LOCALE = typeof navigator === "undefined" ? "en-GB" : navigator.language;

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Converts a 13-digit millisecond epoch time string/number to a 10-digit
 * second epoch time string/number by truncating milliseconds. We only up to the second,
 * so the processed data doesn't need to store the ms.
 */
export const convertMsEpochToSecEpoch = (epochMs: number | string): number => Math.trunc(Number(epochMs) / MS_PER_SECOND);

/**
 * Converts a 13-digit millisecond epoch time to a simplified ISO 8601 string,
 * suitable for serialization (YYYY-MM-DDTHH:mm:ss, without milliseconds or Z).
 * This is the standard format required for the geocode storage date field.
 */
export const formatEpochToSerializationString = (epochTimeMs: number | string): string => Temporal.Instant.fromEpochMilliseconds(Number(epochTimeMs))
        .toZonedDateTimeISO("UTC")
        .toPlainDateTime()
        .toString({ smallestUnit: "second" });

/**
 * Formats the serialized ISO 8601 string (YYYY-MM-DDTHH:mm:ss) into a locale-specific short date string (e.g., 3/15/2023).
 */
export const formatIsoToShortDate = (isoString: string, timeZone: string, locale: string = DEFAULT_LOCALE): string => {
    let instant: Temporal.Instant;
    try {
        instant = Temporal.Instant.from(isoString);
    } catch {
        instant = Temporal.Instant.from(isoString + "Z");
    }
    return instant.toZonedDateTimeISO(timeZone).toLocaleString(locale, { dateStyle: "short" });
};

/**
 * Formats an epoch time for local display time.
 */
export const formatEpochToLocalTime = (epochMs: number | string, timeZone: string, locale: string = DEFAULT_LOCALE): string => Temporal.Instant.fromEpochMilliseconds(Number(epochMs)).toZonedDateTimeISO(timeZone).toLocaleString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
    });

/**
 * Formats an epoch time for local date and time display.
 */
export const formatEpochToLocalDateTime = (epochMs: number | string, timeZone: string, locale: string = DEFAULT_LOCALE): string => Temporal.Instant.fromEpochMilliseconds(Number(epochMs)).toZonedDateTimeISO(timeZone).toLocaleString(locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

/**
 * Checks if a given timestamp is within 24 hours of a reference timestamp.
 */
export const isWithin24Hours = (targetTimeMs: number | string, referenceTimeMs: number | string): boolean => {
    const target = Number(targetTimeMs);
    const reference = Number(referenceTimeMs);

    const differenceMs = Math.abs(target - reference);

    return differenceMs <= MS_PER_DAY;
};

/**
 * Creates a new Date object for a wave's start or end time, preserving the timezone of the original site event.
 * It correctly combines the date from the event's ISO string with a new time string.
 * @param {string} siteDateIso - The original ISO 8601 date string for the site (e.g., "2025-11-15T14:00:00+01:00").
 * @param {string} siteTimezone - The IANA timezone name for the site (e.g., "Europe/Amsterdam").
 * @param {string} timeStr - The time string for the wave (e.g., "14:02").
 * @returns {Date} A new Date object representing the precise start/end of the wave.
 */
export const createWaveDate = (siteDateIso: string, siteTimezone: string, timeStr: string): Date => {
    const [hour, minute] = timeStr.split(":").map(Number);

    // 1. Parse the ISO string to an Instant, then convert to ZonedDateTime in the target timezone.
    const zonedDateTime = Temporal.Instant.from(siteDateIso).toZonedDateTimeISO(siteTimezone);

    // 2. Set the desired time. Temporal handles timezone/DST disambiguation (default is 'compatible').
    const waveDateTime = zonedDateTime.with({
        ...(typeof hour === "number" && !isNaN(hour) && { hour }),
        ...(typeof minute === "number" && !isNaN(minute) && { minute }),
        second: 0,
        millisecond: 0,
    });

    // 3. Convert back to a native Date object (epoch milliseconds).
    return new Date(waveDateTime.epochMilliseconds);
};
