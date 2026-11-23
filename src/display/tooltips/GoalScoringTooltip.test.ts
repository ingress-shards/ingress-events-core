import { describe, it, expect } from "vitest";
import { renderGoalScoringTooltip, createGoalScoringTooltipResolver } from "./GoalScoringTooltip.js";
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
        activeDurationMinutes: 30,
        shards: [],
    },
};

describe("renderGoalScoringTooltip", () => {
    it("renders scored and unscored target portal counts", () => {
        const waveState: WaveState = {
            points: {},
            shardJumpWindows: [
                {
                    jumpNumber: 1,
                    scheduledStart: 1_780_315_200_000,
                    actualEnd: 1_780_315_200_000,
                    actionCount: 2,
                    goalsBreakdown: { ENL: [{ portalId: 101, scoredCount: 2, unscoredCount: 1 }] },
                },
            ],
        };

        const html = renderGoalScoringTooltip({
            siteConfig,
            waveState,
            faction: "ENL",
            portals: { 101: { title: "Big Ben", latE6: 0, lngE6: 0 } },
            goalRules: [{ label: "Target Goal", points: 5 }],
        });
        expect(html).toContain("Target Portal (5pt)");
        expect(html).toContain("Big Ben");
        expect(html).toContain("2 (1)");
    });
});

describe("createGoalScoringTooltipResolver", () => {
    const mockRegistry = {
        blueprints: { goalScoringRules: { goal_rule: { label: "Target Goal", points: 5 } } },
        getSiteConfig: (siteId: string) => (siteId === "site-1" ? siteConfig : undefined),
        getSeasonMetadata: (seasonId: string) =>
            seasonId === "season-1"
                ? {
                    id: "season-1",
                    events: [{ eventType: "SKIRMISH", mechanics: { shards: { scoring: { goalRules: ["goal_rule"] } } } }],
                }
                : undefined,
    } as unknown as ConfigRegistry;

    const siteState: SiteState = {
        metadata: { siteId: "site-1", seasonId: "season-1", lastUpdated: 0 },
        telemetry: { portals: { 101: { title: "Big Ben", latE6: 0, lngE6: 0 } } },
        analysis: {
            waves: {
                1: {
                    points: {},
                    shardJumpWindows: [
                        {
                            jumpNumber: 1,
                            scheduledStart: 1_780_315_200_000,
                            actualEnd: 1_780_315_200_000,
                            actionCount: 2,
                            goalsBreakdown: { ENL: [{ portalId: 101, scoredCount: 2, unscoredCount: 1 }] },
                        },
                    ],
                },
            },
        },
    };

    it("extracts goal rules and portals to resolve goal scoring HTML", async () => {
        const resolve = createGoalScoringTooltipResolver(mockRegistry, (id) => Promise.resolve(id === "site-1" ? siteState : undefined));
        const trigger = { dataset: { siteId: "site-1", wave: "1", faction: "ENL" } } as unknown as HTMLElement;

        const html = await resolve(trigger);
        expect(html).toContain("Target Portal (5pt)");
        expect(html).toContain("Big Ben");
    });

    it("returns undefined when faction or state is missing", async () => {
        const resolve = createGoalScoringTooltipResolver(mockRegistry, (id) => (id === "site-1" ? siteState : undefined));

        expect(await resolve({ dataset: { siteId: "site-1", wave: "1" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "missing", wave: "1", faction: "ENL" } } as unknown as HTMLElement)).toBeUndefined();
    });
});
