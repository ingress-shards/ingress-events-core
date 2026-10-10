import { describe, it, expect } from "vitest";
import { fromFields as durationFromFields } from "temporal-polyfill/fns/Duration";
import { subtract as zdtSubtract, toInstant as zdtToInstant } from "temporal-polyfill/fns/ZonedDateTime";
import { parseZonedDateTime } from "../common/Date.js";
import { SiteManager } from "./SiteManager.js";
import { SitePhase } from "../sites/Site.js";
import type { ShardMechanics, SiteManifestMetadata } from "../types/index.js";

describe("Site Manager", () => {
    describe("getExpectedShardCount", () => {
        const mechanics: ShardMechanics = {
            waves: [
                { startOffset: 0, endOffset: 30, quantity: 5 },
                { startOffset: 60, endOffset: 90, quantity: 5 },
            ],
            waveActions: [],
        };

        it("should return sum of waves if no override exists", () => {
            expect(SiteManager.getExpectedShardCount(mechanics)).toBe(10);
        });

        it("should return sum of shardCounts if override exists", () => {
            const override: SiteManifestMetadata = {
                name: "Test",
                latE6: 0,
                lngE6: 0,
                shardCounts: [2, 2, 2],
            };
            expect(SiteManager.getExpectedShardCount(mechanics, override)).toBe(6);
        });
    });

    describe("getEventDuration", () => {
        it("should calculate duration correctly", () => {
            const mechanics: ShardMechanics = {
                waves: [{ startOffset: 120, endOffset: 150 }],
                waveActions: [
                    { action: "spawn", time: 0 },
                    { action: "jump", time: 30 },
                ],
            };
            // lastWaveStart (120) + lastJumpOffset (30) + 1 = 151
            expect(SiteManager.getEventDuration(mechanics)).toBe(151);
        });
    });

    describe("formatSiteStatus", () => {
        it("should format Scheduled status", () => {
            const timeRemaining = durationFromFields({ hours: 1, minutes: 30 });
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Scheduled,
                    timeRemaining,
                }),
            ).toBe("Starts in 1h 30m");
        });

        it("should format Stand By status", () => {
            const timeRemaining = durationFromFields({ minutes: 12 });
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.StandBy,
                    timeRemaining,
                }),
            ).toBe("Stand By · 12m");
        });

        it("should format Active status", () => {
            const timeRemaining = durationFromFields({ minutes: 45 });
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Active,
                    timeRemaining,
                }),
            ).toBe("Active · 45m");
        });

        it("should format status without time remaining", () => {
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Scheduled,
                    timeRemaining: undefined,
                }),
            ).toBe("Starts soon");

            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.StandBy,
                    timeRemaining: undefined,
                }),
            ).toBe("Stand By");

            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Active,
                    timeRemaining: undefined,
                }),
            ).toBe("Active");
        });

        it("should return display name for other phases", () => {
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Complete,
                    timeRemaining: undefined,
                }),
            ).toBe("Complete");

            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Processing,
                    timeRemaining: undefined,
                }),
            ).toBe("Processing");

            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.NoData,
                    timeRemaining: undefined,
                }),
            ).toBe("No Data");
        });
    });

    describe("calculatePhase", () => {
        const startTime = parseZonedDateTime("2026-10-24T14:00:00Z[UTC]");
        const baseParameters = {
            startTime,
            eventDurationMins: 60,
            shards: { actual: 0, expected: 5 },
            hasOrnaments: false,
        };

        it("should return Scheduled when more than 15 minutes before start", () => {
            const twentyMinsBefore = zdtToInstant(zdtSubtract(startTime, durationFromFields({ minutes: 20 })));
            expect(SiteManager.calculatePhase(baseParameters, twentyMinsBefore)).toBe(SitePhase.Scheduled);
        });

        it("should return StandBy when within 15 minutes before start", () => {
            const tenMinsBefore = zdtToInstant(zdtSubtract(startTime, durationFromFields({ minutes: 10 })));
            expect(SiteManager.calculatePhase(baseParameters, tenMinsBefore)).toBe(SitePhase.StandBy);

            const exactlyFifteenMinsBefore = zdtToInstant(zdtSubtract(startTime, durationFromFields({ minutes: 15 })));
            expect(SiteManager.calculatePhase(baseParameters, exactlyFifteenMinsBefore)).toBe(SitePhase.StandBy);
        });

        it("should return Active at start time", () => {
            const atStart = zdtToInstant(startTime);
            expect(SiteManager.calculatePhase(baseParameters, atStart)).toBe(SitePhase.Active);
        });
    });
});
