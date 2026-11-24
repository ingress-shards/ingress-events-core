import { describe, it, expect } from "vitest";
import { renderFlagIcon } from "./FlagIcon.js";

describe("renderFlagIcon", () => {
    it("renders lowercase flag-icons span for valid country codes", () => {
        expect(renderFlagIcon("gb")).toBe('<span class="fi fi-gb"></span>');
        expect(renderFlagIcon("GB")).toBe('<span class="fi fi-gb"></span>');
        expect(renderFlagIcon(" us ")).toBe('<span class="fi fi-us"></span>');
    });

    it("returns an empty string for missing or blank country codes", () => {
        expect(renderFlagIcon()).toBe("");
        expect(renderFlagIcon("")).toBe("");
        expect(renderFlagIcon(" ".repeat(3))).toBe("");
    });
});
