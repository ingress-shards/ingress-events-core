import { describe, it, expect } from "vitest";
import { createPathTooltipResolver, renderPathTooltip } from "./PathTooltip.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { ShardPath } from "../../sites/Shard.js";
import type { SiteState } from "../../sites/Site.js";

const portalA: ObservedPortal = { title: "Portal A", latE6: 0, lngE6: 0 };
const portalB: ObservedPortal = { title: "Portal B", latE6: 1000, lngE6: 1000 };

const siteConfig: SiteConfig = {
    seasonId: "season-1",
    geocode: {
        id: "site-1",
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
        end: 1_780_317_000_000,
        activeDurationMinutes: 30,
        shards: [],
    },
};

describe("renderPathTooltip", () => {
    it("renders unidirectional link path tooltip with points", () => {
        const shardPath: ShardPath = {
            distance: 1500,
            links: [
                {
                    linkTime: 1_780_315_200_000,
                    align: "ENL",
                    moves: [{ origin: 1, dest: 2, shardId: 4, moveTime: 1_780_315_205_000, totalPoints: 3 }],
                },
            ],
        };

        const html = renderPathTooltip({ shardPath, portalA, portalB, portalAId: 1, siteConfig });
        expect(html).toContain("Portal A -&gt; Portal B (1.50km)");
        expect(html).toContain("ENL");
        expect(html).toContain("Shard 4</strong> jumped at");
        expect(html).toContain("for 3 points");
    });

    it("renders random teleport path tooltip", () => {
        const shardPath: ShardPath = {
            distance: 420,
            links: [],
            teleports: [{ origin: 2, dest: 1, shardId: 7, moveTime: 1_780_315_205_000 }],
        };

        const html = renderPathTooltip({ shardPath, portalA, portalB, portalAId: 1 });
        expect(html).toContain("Portal B -&gt; Portal A (420m)");
        expect(html).toContain("Shard 7</strong> randomly teleported at");
    });
});

describe("createPathTooltipResolver", () => {
    const mockRegistry = {
        blueprints: {},
        getSiteConfig: (siteId: string) => (siteId === "site-1" ? siteConfig : undefined),
        getSeasonMetadata: () => undefined,
    } as unknown as ConfigRegistry;

    const siteState: SiteState = {
        metadata: { siteId: "site-1", seasonId: "season-1", lastUpdated: 0 },
        telemetry: { portals: { 1: portalA, 2: portalB } },
        analysis: {
            waves: {},
            shardPaths: {
                "1-2": {
                    distance: 1500,
                    links: [
                        {
                            linkTime: 1_780_315_200_000,
                            align: "ENL",
                            moves: [{ origin: 1, dest: 2, shardId: 4, moveTime: 1_780_315_205_000, totalPoints: 3 }],
                        },
                    ],
                },
            },
        },
    };

    it("resolves path tooltip HTML from siteId and pathKey dataset attributes", async () => {
        const resolve = createPathTooltipResolver(mockRegistry, (id) => (id === "site-1" ? siteState : undefined));
        const trigger = { dataset: { siteId: "site-1", pathKey: "1-2" } } as unknown as HTMLElement;

        const html = await resolve(trigger);
        expect(html).toContain("Portal A -&gt; Portal B (1.50km)");
        expect(html).toContain("Shard 4");
    });

    it("returns undefined for malformed, missing, or unknown pathKey", async () => {
        const resolve = createPathTooltipResolver(mockRegistry, () => siteState);
        expect(await resolve({ dataset: { siteId: "site-1" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", pathKey: "bad-key" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", pathKey: "1-" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", pathKey: "invalid" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", pathKey: "1-99" } } as unknown as HTMLElement)).toBeUndefined();
    });
});
