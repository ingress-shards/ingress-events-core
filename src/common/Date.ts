import type { Temporal } from "temporal-polyfill";

/**
 * Formats a Temporal.Duration into a human-readable string (e.g., 1d 4h 30m).
 */
export const formatDuration = (d: Temporal.Duration): string => {
    const parts: string[] = [];
    if (d.days > 0) parts.push(`${d.days}d`);
    if (d.hours > 0) parts.push(`${d.hours}h`);
    parts.push(`${d.minutes}m`);
    return parts.join(" ");
};
