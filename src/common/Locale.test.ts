import { describe, it, expect, afterEach } from "vitest";
import { getDefaultLocale, getLocale, setLocale, resolveLocale } from "./Locale.js";

describe("Locale", () => {
    afterEach(() => {
        setLocale(undefined);
    });

    it("falls back to en-GB when navigator is unavailable or returns default", () => {
        const defaultLocale = getDefaultLocale();
        expect(typeof defaultLocale).toBe("string");
        expect(defaultLocale.length).toBeGreaterThan(0);
    });

    it("allows overriding and resetting the active locale", () => {
        setLocale("ja-JP");
        expect(getLocale()).toBe("ja-JP");
        expect(resolveLocale()).toBe("ja-JP");
        expect(resolveLocale("de-DE")).toBe("de-DE");

        setLocale(undefined);
        expect(getLocale()).toBe(getDefaultLocale());
    });
});
