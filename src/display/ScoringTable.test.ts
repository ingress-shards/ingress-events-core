import { describe, it, expect } from "vitest";
import { renderScoringTable } from "./ScoringTable.js";
import type { SiteConfig } from "../config/SiteConfig.js";
import type { SiteState } from "../sites/Site.js";

const createSiteConfig = (hasTargets = false): SiteConfig => ({
    seasonId: "2026-test",
    geocode: {
        id: "site-london",
        name: "London",
        eventType: "ANOMALY",
        latE6: 51_500_000,
        lngE6: -100_000,
        startTime: "2026-06-01T12:00:00Z[UTC]",
        timeZone: "UTC",
        countryCode: "GB",
    },
    timeline: {
        start: 1_780_315_200_000,
        preEventCutoff: 1_780_308_000_000,
        end: 1_780_318_800_000,
        durationMinutes: 60,
        shards: [
            { waveNumber: 1, start: 1_780_315_200_000, end: 1_780_317_000_000, expectedShards: 5 },
            { waveNumber: 2, start: 1_780_317_000_000, end: 1_780_318_800_000, expectedShards: 5 },
        ],
        ...(hasTargets && {
            targets: [{ waveNumber: 1, start: 1_780_315_200_000, end: 1_780_317_000_000 }],
        }),
    },
});

describe("renderScoringTable", () => {
    it("returns empty string when siteState or first wave jump windows are missing", () => {
        const config = createSiteConfig();
        expect(renderScoringTable(config)).toBe("");
        expect(
            renderScoringTable(config, {
                metadata: { siteId: "site-london", seasonId: "2026-test", lastUpdated: 0 },
                analysis: { waves: { 1: { points: {}, shardJumpWindows: [] } } },
            }),
        ).toBe("");
    });

    it("renders Jumps and Points columns with data-tooltip-type triggers", () => {
        const config = createSiteConfig(false);
        const state: SiteState = {
            metadata: { siteId: "site-london", seasonId: "2026-test", lastUpdated: 0 },
            analysis: {
                waves: {
                    1: {
                        points: { links: { ENL: 2, RES: 0 }, total: { ENL: 2, RES: 0 } },
                        shardJumpWindows: [{ scheduledStart: 1000, actualEnd: 2000, jumpNumber: 1, actionCount: 2 }],
                    },
                },
            },
        };

        const html = renderScoringTable(config, state);
        expect(html).toContain('<table class="scoring-table">');
        expect(html).toContain('<col class="faction-enl-bg"');
        expect(html).toContain('<col class="faction-res-bg"');
        expect(html).not.toContain(">Goal<");
        expect(html).toContain('data-tooltip-type="wave" data-site-id="site-london" data-wave="1"');
        expect(html).toContain('data-tooltip-type="links" data-site-id="site-london" data-wave="1" data-faction="ENL"');
        expect(html).toContain('<tr class="scoring-total-row">');
        expect(html).toContain("POINTS");
    });

    it("renders Goal columns, contributing wave highlights, and SEASON POINTS", () => {
        const config = createSiteConfig(true);
        const state: SiteState = {
            metadata: { siteId: "site-london", seasonId: "2026-test", lastUpdated: 0 },
            analysis: {
                seasonPointsResult: {
                    points: { ENL: 35.5, RES: 64.5 },
                    contributingWaves: { RES: [1] },
                },
                waves: {
                    1: {
                        points: {
                            goals: { ENL: 5, RES: 10 },
                            links: { ENL: 1, RES: 2 },
                            total: { ENL: 6, RES: 12 },
                        },
                        shardJumpWindows: [{ scheduledStart: 1000, actualEnd: 2000, jumpNumber: 1, actionCount: 3 }],
                    },
                },
            },
        };

        const html = renderScoringTable(config, state);
        expect(html).toContain(">Goal<");
        expect(html).toContain('data-tooltip-type="goals" data-site-id="site-london" data-wave="1" data-faction="RES"');
        expect(html).toContain("scoring-contributor-res");
        expect(html).toContain("SEASON POINTS");
        expect(html).toContain("35.5");
        expect(html).toContain("64.5");
    });
});
