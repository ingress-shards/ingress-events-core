import { describe, it, expect } from "vitest";
import { MS_PER_MINUTE } from "../common/Date.js";
import { SitePhase } from "../sites/Site.js";
import { formatSiteStatus } from "./SiteStatus.js";

describe("formatSiteStatus", () => {
    const now = 1_700_000_000_000;

    it("formats Scheduled and Discovery statuses with time range", () => {
        expect(
            formatSiteStatus({
                phase: SitePhase.Scheduled,
                fromMs: now,
                toMs: now + 90 * MS_PER_MINUTE,
            }),
        ).toBe("Starts in 1h 30m");

        expect(
            formatSiteStatus({
                phase: SitePhase.Discovery,
                fromMs: now,
                toMs: now + 90 * MS_PER_MINUTE,
            }),
        ).toBe("Starts in 1h 30m");
    });

    it("formats Stand By status with time range", () => {
        expect(
            formatSiteStatus({
                phase: SitePhase.StandBy,
                fromMs: now,
                toMs: now + 12 * MS_PER_MINUTE,
            }),
        ).toBe("Stand By · 12m");
    });

    it("formats Active status with time range", () => {
        expect(
            formatSiteStatus({
                phase: SitePhase.Active,
                fromMs: now,
                toMs: now + 45 * MS_PER_MINUTE,
            }),
        ).toBe("Active · 45m");
    });

    it("formats countdown statuses without time remaining", () => {
        expect(formatSiteStatus({ phase: SitePhase.Scheduled })).toBe("Starts soon");
        expect(formatSiteStatus({ phase: SitePhase.Discovery })).toBe("Starts soon");
        expect(formatSiteStatus({ phase: SitePhase.StandBy })).toBe("Stand By");
        expect(formatSiteStatus({ phase: SitePhase.Active })).toBe("Active");
    });

    it("returns display name for non-countdown phases", () => {
        expect(formatSiteStatus({ phase: SitePhase.Complete })).toBe("Complete");
        expect(formatSiteStatus({ phase: SitePhase.Processing })).toBe("Processing");
        expect(formatSiteStatus({ phase: SitePhase.NoData })).toBe("No Data");
    });
});
