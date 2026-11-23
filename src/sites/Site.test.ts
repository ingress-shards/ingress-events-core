import { describe, it, expect } from "vitest";
import { MS_PER_DAY, MS_PER_MINUTE } from "../common/Date.js";
import { calculateSitePhase, SitePhase } from "./Site.js";

describe("calculateSitePhase", () => {
    const startMs = 1_792_850_400_000;
    const activeDurationMinutes = 60;
    const endMs = startMs + activeDurationMinutes * MS_PER_MINUTE;

    const baseParameters = {
        startMs,
        activeDurationMinutes,
        shards: { actual: 0, expected: 5 },
        hasOrnaments: false,
    };

    it("returns Scheduled when more than 15 minutes before start without ornaments", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: startMs - 20 * MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.Scheduled);
    });

    it("returns Discovery when more than 15 minutes before start with ornaments", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                hasOrnaments: true,
                nowMs: startMs - 20 * MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.Discovery);
    });

    it("returns StandBy within 15 minutes before start (including exact boundary)", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: startMs - 10 * MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.StandBy);

        expect(
            calculateSitePhase({
                ...baseParameters,
                hasOrnaments: true,
                nowMs: startMs - 15 * MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.StandBy);
    });

    it("returns Active from startMs through endMs inclusive", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: startMs,
            }),
        ).toBe(SitePhase.Active);

        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: startMs + 30 * MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.Active);

        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: endMs,
            }),
        ).toBe(SitePhase.Active);
    });

    it("returns Complete after endMs when all expected shards are recorded", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                shards: { actual: 5, expected: 5 },
                nowMs: endMs + 1,
            }),
        ).toBe(SitePhase.Complete);
    });

    it("returns Processing after endMs when data is incomplete and before stale threshold", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: endMs + 60 * MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.Processing);

        expect(
            calculateSitePhase({
                ...baseParameters,
                shards: { actual: 2, expected: 5 },
                nowMs: endMs + MS_PER_DAY + MS_PER_MINUTE,
            }),
        ).toBe(SitePhase.Processing);
    });

    it("returns NoData 24 hours or more after endMs when zero shards are recorded", () => {
        expect(
            calculateSitePhase({
                ...baseParameters,
                nowMs: endMs + MS_PER_DAY,
            }),
        ).toBe(SitePhase.NoData);
    });
});
