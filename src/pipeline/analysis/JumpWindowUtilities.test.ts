import { describe, it, expect } from "vitest";
import { isMovementInWindow, type JumpWindowBounds } from "./JumpWindowUtilities.js";

describe("JumpWindowUtilities", () => {
    const windowBounds: JumpWindowBounds = {
        windowStart: 1500,
        nextWindowStart: 1800,
        waveStart: 1000,
        waveEnd: 2000
    };

    it("should accept valid jump, link, and no move actions within window boundaries", () => {
        expect(isMovementInWindow({ action: "jump", moveTime: 1500 }, windowBounds)).toBe(true);
        expect(isMovementInWindow({ action: "link", moveTime: 1650 }, windowBounds)).toBe(true);
        expect(isMovementInWindow({ action: "no move", moveTime: 1799 }, windowBounds)).toBe(true);
    });

    it("should reject actions outside wave boundaries", () => {
        expect(isMovementInWindow({ action: "jump", moveTime: 999 }, windowBounds)).toBe(false);
        expect(isMovementInWindow({ action: "jump", moveTime: 2001 }, windowBounds)).toBe(false);
    });

    it("should reject actions before windowStart or at/after nextWindowStart", () => {
        expect(isMovementInWindow({ action: "jump", moveTime: 1499 }, windowBounds)).toBe(false);
        expect(isMovementInWindow({ action: "jump", moveTime: 1800 }, windowBounds)).toBe(false);
        expect(isMovementInWindow({ action: "jump", moveTime: 1850 }, windowBounds)).toBe(false);
    });

    it("should reject non-movement action types", () => {
        expect(isMovementInWindow({ action: "spawn", moveTime: 1500 }, windowBounds)).toBe(false);
        expect(isMovementInWindow({ action: "despawn", moveTime: 1500 }, windowBounds)).toBe(false);
    });

    it("should support the final window when nextWindowStart is undefined", () => {
        const finalWindow: JumpWindowBounds = {
            windowStart: 1800,
            waveStart: 1000,
            waveEnd: 2000
        };

        expect(isMovementInWindow({ action: "jump", moveTime: 1800 }, finalWindow)).toBe(true);
        expect(isMovementInWindow({ action: "jump", moveTime: 1950 }, finalWindow)).toBe(true);
        expect(isMovementInWindow({ action: "jump", moveTime: 2000 }, finalWindow)).toBe(true);
        expect(isMovementInWindow({ action: "jump", moveTime: 2001 }, finalWindow)).toBe(false);
    });
});
