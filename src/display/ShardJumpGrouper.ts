import { fromEpochMilliseconds, toZonedDateTimeISO } from "temporal-polyfill/fns/Instant";
import type { ShardJumpWindow, ShardJumpGroup } from "../sites/Site.js";

/**
 * Groups consecutive shard jump windows into batches of `jumpGroupSize` (default: 1).
 * Automatically derives human-friendly labels (e.g., "J1-3" or "J1").
 */
export const getShardJumpGroups = (
    windows: ShardJumpWindow[],
    jumpGroupSize = 1
): ShardJumpGroup[] => {
    const groups: ShardJumpGroup[] = [];
    if (!windows || windows.length === 0) return groups;

    const size = Math.max(1, Math.floor(jumpGroupSize));

    for (let i = 0; i < windows.length; i += size) {
        const chunk = windows.slice(i, i + size);
        const groupIndex = Math.floor(i / size) + 1;
        const jumpNumbers = chunk.map((w) => w.jumpNumber);
        const min = Math.min(...jumpNumbers);
        const max = Math.max(...jumpNumbers);
        const label = min === max ? `J${min}` : `J${min}-${max}`;

        groups.push({
            groupIndex,
            label,
            windows: chunk
        });
    }

    return groups;
};

/**
 * Formats the time label for a jump group.
 * - 0 windows: returns ""
 * - 1 window (single jump or 1 jump remainder): "HH:mm" (e.g., "14:40")
 * - Multiple windows, same hour (full group or 2-jump remainder): "HH:mm-mm" (e.g., "14:20-25")
 * - Multiple windows, different hours: "HH:mm-HH:mm" (e.g., "14:55-15:05")
 */
export const formatJumpGroupTime = (
    group: ShardJumpGroup,
    timeZone = "UTC"
): string => {
    if (!group?.windows || group.windows.length === 0) return "";
    const firstWin = group.windows[0]!;
    const startZdt = toZonedDateTimeISO(fromEpochMilliseconds(firstWin.timestamp), timeZone);
    const startHour = String(startZdt.hour).padStart(2, "0");
    const startMin = String(startZdt.minute).padStart(2, "0");
    const startStr = `${startHour}:${startMin}`;

    if (group.windows.length === 1) {
        return startStr;
    }

    const lastWin = group.windows.at(-1)!;
    const endZdt = toZonedDateTimeISO(fromEpochMilliseconds(lastWin.timestamp), timeZone);
    const endHour = String(endZdt.hour).padStart(2, "0");
    const endMin = String(endZdt.minute).padStart(2, "0");

    if (startHour === endHour) {
        return `${startStr}-${endMin}`;
    }

    return `${startStr}-${endHour}:${endMin}`;
};
