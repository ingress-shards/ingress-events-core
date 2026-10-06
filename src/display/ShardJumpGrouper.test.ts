import { describe, it, expect } from "vitest";
import { getShardJumpGroups, formatJumpGroupTime } from "./ShardJumpGrouper.js";
import type { ShardJumpWindow } from "../sites/Site.js";

describe("ShardJumpGrouper", () => {
    it("returns empty array for empty windows", () => {
        expect(getShardJumpGroups([])).toEqual([]);
    });

    it("defaults to jumpGroupSize of 1 and derives individual J<n> labels", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: 1000, jumpNumber: 1, points: {}, historyCount: 2 },
            { timestamp: 2000, jumpNumber: 2, points: {}, historyCount: 1 }
        ];

        const groups = getShardJumpGroups(windows);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toEqual({
            groupIndex: 1,
            label: "J1",
            windows: [windows[0]]
        });
        expect(groups[1]).toEqual({
            groupIndex: 2,
            label: "J2",
            windows: [windows[1]]
        });
    });

    it("groups windows by specified jumpGroupSize and derives range labels", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: 1000, jumpNumber: 1, points: {}, historyCount: 1 },
            { timestamp: 1100, jumpNumber: 2, points: {}, historyCount: 1 },
            { timestamp: 1200, jumpNumber: 3, points: {}, historyCount: 1 },
            { timestamp: 2000, jumpNumber: 4, points: {}, historyCount: 1 },
            { timestamp: 2100, jumpNumber: 5, points: {}, historyCount: 1 }
        ];

        const groups = getShardJumpGroups(windows, 3);
        expect(groups).toHaveLength(2);

        expect(groups[0]!.groupIndex).toBe(1);
        expect(groups[0]!.label).toBe("J1-3");
        expect(groups[0]!.windows).toEqual([windows[0], windows[1], windows[2]]);

        expect(groups[1]!.groupIndex).toBe(2);
        expect(groups[1]!.label).toBe("J4-5");
        expect(groups[1]!.windows).toEqual([windows[3], windows[4]]);
    });

    it("derives single J<n> label if a group contains only one jump", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: 1000, jumpNumber: 7, points: {}, historyCount: 3 }
        ];

        const groups = getShardJumpGroups(windows, 3);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.groupIndex).toBe(1);
        expect(groups[0]!.label).toBe("J7");
        expect(groups[0]!.windows).toEqual([windows[0]]);
    });

    it("handles jumpGroupSize larger than windows length", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: 1000, jumpNumber: 1, points: {}, historyCount: 1 },
            { timestamp: 1100, jumpNumber: 2, points: {}, historyCount: 1 }
        ];

        const groups = getShardJumpGroups(windows, 5);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.groupIndex).toBe(1);
        expect(groups[0]!.label).toBe("J1-2");
        expect(groups[0]!.windows).toHaveLength(2);
    });
});

describe("formatJumpGroupTime", () => {
    const t1400 = 1792850400000;
    const t1405 = 1792850700000;
    const t1410 = 1792851000000;
    const t1415 = 1792851300000;
    const t1420 = 1792851600000;
    const t1430 = 1792852200000;
    const t1440 = 1792852800000;
    const t1450 = 1792853400000;
    const t1505 = 1792854300000;

    it("returns empty string when group has no windows", () => {
        const emptyGroup = { groupIndex: 1, label: "J1", windows: [] };
        expect(formatJumpGroupTime(emptyGroup)).toBe("");
    });

    it("formats a single jump window as HH:mm", () => {
        const group = {
            groupIndex: 1,
            label: "J1",
            windows: [{ timestamp: t1400, jumpNumber: 1, points: {}, historyCount: 1 }]
        };
        expect(formatJumpGroupTime(group)).toBe("14:00");
    });

    it("formats multiple jumps within the same hour displaying only the end minutes (HH:mm-mm)", () => {
        const group = {
            groupIndex: 1,
            label: "J1-3",
            windows: [
                { timestamp: t1400, jumpNumber: 1, points: {}, historyCount: 1 },
                { timestamp: t1405, jumpNumber: 2, points: {}, historyCount: 1 },
                { timestamp: t1410, jumpNumber: 3, points: {}, historyCount: 1 }
            ]
        };
        expect(formatJumpGroupTime(group)).toBe("14:00-10");
    });

    it("formats multiple jumps across an hour boundary as full range (HH:mm-HH:mm)", () => {
        const group = {
            groupIndex: 1,
            label: "J1-2",
            windows: [
                { timestamp: t1450, jumpNumber: 1, points: {}, historyCount: 1 },
                { timestamp: t1505, jumpNumber: 2, points: {}, historyCount: 1 }
            ]
        };
        expect(formatJumpGroupTime(group)).toBe("14:50-15:05");
    });

    it("handles an uneven remainder of only 1 jump when group size is 2", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: t1400, jumpNumber: 1, points: {}, historyCount: 1 },
            { timestamp: t1410, jumpNumber: 2, points: {}, historyCount: 1 },
            { timestamp: t1420, jumpNumber: 3, points: {}, historyCount: 1 },
            { timestamp: t1430, jumpNumber: 4, points: {}, historyCount: 1 },
            { timestamp: t1440, jumpNumber: 5, points: {}, historyCount: 1 }
        ];

        const groups = getShardJumpGroups(windows, 2);
        expect(groups).toHaveLength(3);

        // Full groups of 2
        expect(groups[0]!.label).toBe("J1-2");
        expect(formatJumpGroupTime(groups[0]!)).toBe("14:00-10");

        expect(groups[1]!.label).toBe("J3-4");
        expect(formatJumpGroupTime(groups[1]!)).toBe("14:20-30");

        // Uneven remainder: only 1 jump left in group of 2
        expect(groups[2]!.label).toBe("J5");
        expect(formatJumpGroupTime(groups[2]!)).toBe("14:40");
    });

    it("handles an uneven remainder of 2 jumps when group size is 3", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: t1400, jumpNumber: 1, points: {}, historyCount: 1 },
            { timestamp: t1405, jumpNumber: 2, points: {}, historyCount: 1 },
            { timestamp: t1410, jumpNumber: 3, points: {}, historyCount: 1 },
            { timestamp: t1415, jumpNumber: 4, points: {}, historyCount: 1 },
            { timestamp: t1420, jumpNumber: 5, points: {}, historyCount: 1 }
        ];

        const groups = getShardJumpGroups(windows, 3);
        expect(groups).toHaveLength(2);

        // Group 1: 3 jumps
        expect(groups[0]!.label).toBe("J1-3");
        expect(formatJumpGroupTime(groups[0]!)).toBe("14:00-10");

        // Group 2: Uneven remainder of 2 jumps left in group of 3 (same hour)
        expect(groups[1]!.label).toBe("J4-5");
        expect(formatJumpGroupTime(groups[1]!)).toBe("14:15-20");
    });

    it("handles an uneven remainder of 1 jump when group size is 3", () => {
        const windows: ShardJumpWindow[] = [
            { timestamp: t1400, jumpNumber: 1, points: {}, historyCount: 1 },
            { timestamp: t1405, jumpNumber: 2, points: {}, historyCount: 1 },
            { timestamp: t1410, jumpNumber: 3, points: {}, historyCount: 1 },
            { timestamp: t1415, jumpNumber: 4, points: {}, historyCount: 1 }
        ];

        const groups = getShardJumpGroups(windows, 3);
        expect(groups).toHaveLength(2);

        expect(groups[0]!.label).toBe("J1-3");
        expect(formatJumpGroupTime(groups[0]!)).toBe("14:00-10");

        // Uneven remainder: only 1 jump left
        expect(groups[1]!.label).toBe("J4");
        expect(formatJumpGroupTime(groups[1]!)).toBe("14:15");
    });

    it("applies target site timezone correctly", () => {
        const group = {
            groupIndex: 1,
            label: "J1-2",
            windows: [
                { timestamp: t1400, jumpNumber: 1, points: {}, historyCount: 1 },
                { timestamp: t1405, jumpNumber: 2, points: {}, historyCount: 1 }
            ]
        };

        // UTC is 14:00-05
        expect(formatJumpGroupTime(group, "UTC")).toBe("14:00-05");
        // Asia/Tokyo is UTC+9 -> 23:00-05
        expect(formatJumpGroupTime(group, "Asia/Tokyo")).toBe("23:00-05");
        // America/New_York is UTC-4 in October -> 10:00-05
        expect(formatJumpGroupTime(group, "America/New_York")).toBe("10:00-05");
    });
});
