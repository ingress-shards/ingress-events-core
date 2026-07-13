import { describe, it, expect } from "vitest";
import * as Duration from "temporal-polyfill/fns/duration";
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
            expect(SiteManager.getExpectedShardCount(undefined, mechanics)).toBe(10);
        });

        it("should return sum of shardCounts if override exists", () => {
            const override: SiteManifestMetadata = {
                name: "Test",
                latE6: 0,
                lngE6: 0,
                shardCounts: [2, 2, 2],
            };
            expect(SiteManager.getExpectedShardCount(override, mechanics)).toBe(6);
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
            const timeRemaining = Duration.fromFields({ hours: 1, minutes: 30 });
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Scheduled,
                    timeRemaining,
                }),
            ).toBe("starts in 1h 30m");
        });

        it("should format Active status", () => {
            const timeRemaining = Duration.fromFields({ minutes: 45 });
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Active,
                    timeRemaining,
                }),
            ).toBe("<strong>Active</strong> (ends in 45m)");
        });

        it("should format status without time remaining", () => {
            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Scheduled,
                    timeRemaining: undefined,
                }),
            ).toBe("starts soon");

            expect(
                SiteManager.formatStatus({
                    phase: SitePhase.Active,
                    timeRemaining: undefined,
                }),
            ).toBe("<strong>Active</strong>");
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
            ).toBe("No Shard Data Available");
        });
    });
});
