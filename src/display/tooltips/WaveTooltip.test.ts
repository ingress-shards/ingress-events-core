import { describe, it, expect } from "vitest";
import { renderWaveTooltip, createWaveTooltipResolver } from "./WaveTooltip.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { SiteState, WaveState } from "../../sites/Site.js";

const createSiteConfig = (jumpGroupSize?: number): SiteConfig => ({
    seasonId: "season-1",
    geocode: {
        id: "site-1",
        name: "London",
        eventType: "SKIRMISH",
        latE6: 51_500_000,
        lngE6: -100_000,
        startTime: "2026-06-01T12:00:00Z[UTC]",
        timeZone: "UTC",
        countryCode: "GB",
    },
    timeline: {
        start: 1_780_315_200_000,
        preEventCutoff: 1_780_308_000_000,
        end: 1_780_317_000_000,
        durationMinutes: 30,
        ...(jumpGroupSize !== undefined && { jumpGroupSize }),
        shards: [
            {
                waveNumber: 1,
                start: 1_780_315_200_000,
                end: 1_780_317_000_000,
                expectedShards: 5,
            },
        ],
    },
});

describe("renderWaveTooltip", () => {
    it("renders wave summary, jump counts, and extended duration warning", () => {
        const waveState: WaveState = {
            points: {},
            shardJumpWindows: [
                { jumpNumber: 1, scheduledStart: 1_780_315_200_000, actualEnd: 1_780_315_275_000, actionCount: 6 },
                { jumpNumber: 2, scheduledStart: 1_780_315_500_000, actualEnd: 1_780_315_525_000, actionCount: 4 },
                { jumpNumber: 3, scheduledStart: 1_780_315_800_000, actualEnd: 1_780_315_800_000, actionCount: 2 },
            ],
            statistics: { shards: { moving: 5, nonMoving: 0 }, links: 4, paths: 2, targets: 0 },
        };

        const html = renderWaveTooltip({ siteConfig: createSiteConfig(), waveNum: 1, waveState });
        expect(html).toContain("Wave 1 Summary");
        expect(html).toContain("Shards: 5");
        expect(html).toContain("<th>Duration</th>");
        expect(html).toContain('<td class="tooltip-mismatch">1m 15s</td>');
        expect(html).toContain("<td>25s</td>");
        expect(html).toContain("<td>-</td>");
    });

    it("omits Duration column when grouped by jumpGroupSize", () => {
        const waveState: WaveState = {
            points: {},
            shardJumpWindows: [
                { jumpNumber: 1, scheduledStart: 1_780_315_200_000, actualEnd: 1_780_315_275_000, actionCount: 6 },
                { jumpNumber: 2, scheduledStart: 1_780_315_500_000, actualEnd: 1_780_315_525_000, actionCount: 4 },
            ],
            statistics: { shards: { moving: 4, nonMoving: 0 }, links: 4, paths: 2, targets: 0 },
        };

        const html = renderWaveTooltip({ siteConfig: createSiteConfig(2), waveNum: 1, waveState });
        expect(html).toContain("J1-2");
        expect(html).not.toContain("<th>Duration</th>");
    });
});

describe("createWaveTooltipResolver", () => {
    const siteConfig = createSiteConfig();
    const mockRegistry = {
        getSiteConfig: (siteId: string) => (siteId === "site-1" ? siteConfig : undefined),
        getSeasonMetadata: () => undefined,
    } as unknown as ConfigRegistry;

    const siteState: SiteState = {
        metadata: { siteId: "site-1", seasonId: "season-1", lastUpdated: 0 },
        analysis: {
            waves: {
                1: {
                    points: {},
                    shardJumpWindows: [
                        { jumpNumber: 1, scheduledStart: 1_780_315_200_000, actualEnd: 1_780_315_210_000, actionCount: 2 },
                    ],
                    statistics: { shards: { moving: 3, nonMoving: 0 }, links: 1, paths: 1, targets: 0 },
                },
            },
        },
    };

    it("resolves rendered wave tooltip HTML for matching site and wave", async () => {
        const resolve = createWaveTooltipResolver(mockRegistry, (id) => Promise.resolve(id === "site-1" ? siteState : undefined));
        const trigger = { dataset: { siteId: "site-1", wave: "1" } } as unknown as HTMLElement;

        const html = await resolve(trigger);
        expect(html).toContain("Wave 1 Summary");
        expect(html).toContain("Shards: 3");
    });

    it("returns undefined when dataset, config, or wave state is missing", async () => {
        const resolve = createWaveTooltipResolver(mockRegistry, (id) => (id === "site-1" ? siteState : undefined));

        expect(await resolve({ dataset: { siteId: "site-1", wave: "bad" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "unknown", wave: "1" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", wave: "9" } } as unknown as HTMLElement)).toBeUndefined();
    });
});
