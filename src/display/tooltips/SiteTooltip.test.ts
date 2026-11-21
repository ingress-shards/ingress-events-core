import { describe, it, expect } from "vitest";
import { createSiteTooltipResolver, renderSiteTooltip } from "./SiteTooltip.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { SiteState } from "../../sites/Site.js";

const startTimeMs = 1_780_315_200_000;

const createSiteConfig = (durationMinutes = 180): SiteConfig => ({
    seasonId: "season-1",
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
        start: startTimeMs,
        preEventCutoff: startTimeMs - 2 * 60 * 60_000,
        end: startTimeMs + durationMinutes * 60_000,
        durationMinutes,
        shards: [],
    },
});

describe("renderSiteTooltip", () => {
    it("renders upcoming site tooltip with flag and countdown", () => {
        const html = renderSiteTooltip({
            siteConfig: createSiteConfig(),
            eventTypeLabel: "Anomaly",
            nowMs: startTimeMs - 2 * 60 * 60_000,
        });
        expect(html).toContain('<span class="fi fi-gb"></span>');
        expect(html).toContain("<strong>London</strong>");
        expect(html).toContain("(2 hours)");
        expect(html).toContain("Type: Anomaly");
    });

    it("renders active site banner and scores", () => {
        const siteState: SiteState = {
            metadata: { siteId: "site-london", seasonId: "season-1", lastUpdated: 0 },
            telemetry: { portals: { 1: { title: "P1", latE6: 0, lngE6: 0 } } },
            analysis: { waves: {}, seasonPointsResult: { points: { RES: 12, ENL: 8 } } },
        };
        const html = renderSiteTooltip({
            siteConfig: createSiteConfig(),
            eventTypeLabel: "Anomaly",
            siteState,
            nowMs: startTimeMs + 60 * 60_000,
        });
        expect(html).toContain("<strong>Site Active</strong> - 2 hours remaining<hr />");
        expect(html).toContain("RES: 12");
        expect(html).toContain("ENL: 8");
    });

    it("renders no-data notice after event when telemetry is absent", () => {
        const html = renderSiteTooltip({
            siteConfig: createSiteConfig(60),
            eventTypeLabel: "Anomaly",
            nowMs: startTimeMs + 48 * 60 * 60_000,
        });
        expect(html).toContain("<em>No data available</em>");
    });
});

describe("createSiteTooltipResolver", () => {
    const siteConfig = createSiteConfig();
    const mockRegistry = {
        blueprints: { events: { ANOMALY: { label: "Anomaly" } } },
        getSiteConfig: (siteId: string) => (siteId === "site-london" ? siteConfig : undefined),
        getSeasonMetadata: () => undefined,
    } as unknown as ConfigRegistry;

    it("resolves upcoming site tooltip when siteState is absent", async () => {
        const resolve = createSiteTooltipResolver(mockRegistry, () => undefined);
        const trigger = { dataset: { siteId: "site-london" } } as unknown as HTMLElement;

        const html = await resolve(trigger);
        expect(html).toContain("<strong>London</strong>");
        expect(html).toContain("Type: Anomaly");
    });

    it("resolves site tooltip with scores when telemetry and analysis exist", async () => {
        const siteState: SiteState = {
            metadata: { siteId: "site-london", seasonId: "season-1", lastUpdated: 0 },
            telemetry: { portals: { 1: { title: "P1", latE6: 0, lngE6: 0 } } },
            analysis: {
                waves: {},
                seasonPointsResult: { points: { RES: 12, ENL: 8 } },
            },
        };
        const resolve = createSiteTooltipResolver(mockRegistry, (id) => (id === "site-london" ? siteState : undefined));
        const trigger = { dataset: { siteId: "site-london" } } as unknown as HTMLElement;

        const html = await resolve(trigger);
        expect(html).toContain("RES: 12");
        expect(html).toContain("ENL: 8");
    });

    it("sums wave scores when seasonPointsResult is absent and counts ornamented portals", async () => {
        const portalsTelemetry = {
            portals: {
                1: { title: "P1", latE6: 0, lngE6: 0, history: [{ timestamp: 1, type: "pre-event" as const, ornId: "ap1" }] },
                2: { title: "P2", latE6: 0, lngE6: 0 },
            },
        };
        const waveOnlyState: SiteState = {
            metadata: { siteId: "site-london", seasonId: "season-1", lastUpdated: 0 },
            telemetry: portalsTelemetry,
            analysis: {
                waves: {
                    1: { points: { total: { RES: 4, ENL: 2 } }, shardJumpWindows: [{ jumpNumber: 1, scheduledStart: 1, actualEnd: 2, actionCount: 1 }] },
                    2: { points: { total: { RES: 3, ENL: 5 } }, shardJumpWindows: [{ jumpNumber: 1, scheduledStart: 3, actualEnd: 4, actionCount: 1 }] },
                },
            },
        };
        const resolve = createSiteTooltipResolver(mockRegistry, () => waveOnlyState);
        const waveHtml = await resolve({ dataset: { siteId: "site-london" } } as unknown as HTMLElement);
        expect(waveHtml).toContain("RES: 7");
        expect(waveHtml).toContain("ENL: 7");

        const ornamentOnlyState: SiteState = {
            metadata: { siteId: "site-london", seasonId: "season-1", lastUpdated: 0 },
            telemetry: portalsTelemetry,
        };
        const resolveOrnaments = createSiteTooltipResolver(mockRegistry, () => ornamentOnlyState);
        const ornamentHtml = await resolveOrnaments({ dataset: { siteId: "site-london" } } as unknown as HTMLElement);
        expect(ornamentHtml).toContain("1 Ornamented Portal</em>");
    });

    it("returns undefined for unknown siteId or missing dataset", async () => {
        const resolve = createSiteTooltipResolver(mockRegistry, () => undefined);
        expect(await resolve({ dataset: {} } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "unknown" } } as unknown as HTMLElement)).toBeUndefined();
    });
});
