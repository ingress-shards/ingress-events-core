import type { Temporal } from "temporal-polyfill";

/**
 * Formats a Temporal.Duration into a human-readable string (e.g., 1d 4h 30m).
 */
export const formatDuration = (d: Temporal.DurationLike): string => {
    const { days = 0, hours = 0, minutes = 0 } = d;

    if (days === 0 && hours === 0 && minutes === 0) {
        return "< 1m";
    }

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(" ");
};
