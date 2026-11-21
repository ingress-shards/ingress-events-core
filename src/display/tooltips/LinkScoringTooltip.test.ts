import { describe, it, expect } from "vitest";
import { renderLinkScoringTooltip, createLinkScoringTooltipResolver } from "./LinkScoringTooltip.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { SiteState, WaveState } from "../../sites/Site.js";

const siteConfig: SiteConfig = {
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
        shards: [],
    },
};

describe("renderLinkScoringTooltip", () => {
    it("renders rule breakdown and mismatched jumps row", () => {
        const waveState: WaveState = {
            points: {},
            shardJumpWindows: [
                {
                    jumpNumber: 1,
                    scheduledStart: 1_780_315_200_000,
                    actualEnd: 1_780_315_200_000,
                    actionCount: 3,
                    linksBreakdown: { RES: { default_jump: 2 } },
                    mismatchedScoringJumps: { RES: 1 },
                },
            ],
        };

        const html = renderLinkScoringTooltip({
            siteConfig,
            waveState,
            faction: "RES",
            linkRules: { default_jump: { label: "Jump", points: 1 } },
        });
        expect(html).toContain("Jump (1pt)");
        expect(html).toContain("2 pts");
        expect(html).toContain("Mismatched Jumps");
        expect(html).toContain('class="tooltip-mismatch"');
    });
});

describe("createLinkScoringTooltipResolver", () => {
    const mockRegistry = {
        blueprints: { linkScoringRules: { default_jump: { label: "Jump", points: 1 } } },
        getSiteConfig: (siteId: string) => (siteId === "site-1" ? siteConfig : undefined),
        getSeasonMetadata: (seasonId: string) =>
            seasonId === "season-1"
                ? {
                    id: "season-1",
                    events: [{ eventType: "SKIRMISH", mechanics: { shards: { scoring: { linkRules: ["default_jump"] } } } }],
                }
                : undefined,
    } as unknown as ConfigRegistry;

    const siteState: SiteState = {
        metadata: { siteId: "site-1", seasonId: "season-1", lastUpdated: 0 },
        analysis: {
            waves: {
                1: {
                    points: {},
                    shardJumpWindows: [
                        {
                            jumpNumber: 1,
                            scheduledStart: 1_780_315_200_000,
                            actualEnd: 1_780_315_200_000,
                            actionCount: 3,
                            linksBreakdown: { RES: { default_jump: 2 } },
                        },
                    ],
                },
            },
        },
    };

    it("extracts link rules to resolve link scoring HTML", async () => {
        const resolve = createLinkScoringTooltipResolver(mockRegistry, (id) => Promise.resolve(id === "site-1" ? siteState : undefined));
        const trigger = { dataset: { siteId: "site-1", wave: "1", faction: "RES" } } as unknown as HTMLElement;

        const html = await resolve(trigger);
        expect(html).toContain("Jump (1pt)");
        expect(html).toContain("2 pts");
    });

    it("returns undefined when faction or wave state is missing", async () => {
        const resolve = createLinkScoringTooltipResolver(mockRegistry, (id) => (id === "site-1" ? siteState : undefined));

        expect(await resolve({ dataset: { siteId: "site-1", wave: "1" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", wave: "99", faction: "RES" } } as unknown as HTMLElement)).toBeUndefined();
    });
});
