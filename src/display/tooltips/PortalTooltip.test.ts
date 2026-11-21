import { describe, it, expect } from "vitest";
import { createPortalTooltipResolver, renderPortalTooltip } from "./PortalTooltip.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { SiteState } from "../../sites/Site.js";

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
        durationMinutes: 30,
        shards: [],
    },
};

describe("renderPortalTooltip", () => {
    it("renders portal title, Intel link, ornament label, target faction from history, and shard history", () => {
        const portal: ObservedPortal = {
            title: "Tower Bridge",
            latE6: 51_505_456,
            lngE6: -75_356,
            history: [
                { timestamp: 1_780_315_000_000, type: "pre-event", ornId: "ap1" },
                { timestamp: 1_780_315_100_000, type: "target", ornId: "targetres" },
            ],
        };

        const html = renderPortalTooltip({
            portal,
            ornaments: { ap1: { label: "Apollo Ornament", tags: ["pre-event"], style: {} } },
            shardHistory: [
                [1, [{ action: "spawn", moveTime: 1_780_315_200_000, portalId: 1, align: "ENL" }]],
            ],
            siteConfig,
        });

        expect(html).toContain("<strong>Tower Bridge</strong>");
        expect(html).toContain("https://intel.ingress.com/intel?pll=51.505456,-0.075356");
        expect(html).toContain("RES</span></strong> <i>Target Portal</i>");
        expect(html).toContain("<i>Apollo Ornament (ap1)</i>");
        expect(html).toContain("<strong>Shard 1</strong>");
        expect(html).toContain("spawn at ");
    });
});

describe("createPortalTooltipResolver", () => {
    const mockRegistry = {
        blueprints: { ornaments: { ap1: { label: "Apollo Ornament", tags: ["pre-event"], style: {} } } },
        getSiteConfig: (siteId: string) => (siteId === "site-1" ? siteConfig : undefined),
        getSeasonMetadata: () => undefined,
    } as unknown as ConfigRegistry;

    const siteState: SiteState = {
        metadata: { siteId: "site-1", seasonId: "season-1", lastUpdated: 0 },
        telemetry: {
            portals: {
                1: {
                    title: "Tower Bridge",
                    latE6: 51_505_456,
                    lngE6: -75_356,
                    history: [
                        { timestamp: 1, type: "pre-event", ornId: "ap1" },
                        { timestamp: 2, type: "target", ornId: "targetres" },
                    ],
                },
                2: {
                    title: "Enl Target",
                    latE6: 0,
                    lngE6: 0,
                    history: [{ timestamp: 1, type: "target", ornId: "targetenl" }],
                },
            },
            shards: {
                5: { history: [{ action: "spawn", moveTime: 1_780_315_200_000, portalId: 1, align: "ENL" }] },
                2: { history: [{ action: "spawn", moveTime: 1_780_315_250_000, portalId: 1 }] },
            },
        },
    };

    it("resolves portal tooltip HTML with sorted shard history, target faction, and ornaments", async () => {
        const resolve = createPortalTooltipResolver(mockRegistry, (id) => (id === "site-1" ? siteState : undefined));

        const resistanceHtml = await resolve({ dataset: { siteId: "site-1", portalId: "1" } } as unknown as HTMLElement);
        expect(resistanceHtml).toContain("<strong>Tower Bridge</strong>");
        expect(resistanceHtml).toContain("RES</span></strong> <i>Target Portal</i>");
        expect(resistanceHtml).toContain("Apollo Ornament (ap1)");
        expect(resistanceHtml).toContain("<strong>Shard 2</strong>");
        expect(resistanceHtml!.indexOf("Shard 2")).toBeLessThan(resistanceHtml!.indexOf("Shard 5"));

        const enlightenedHtml = await resolve({ dataset: { siteId: "site-1", portalId: "2" } } as unknown as HTMLElement);
        expect(enlightenedHtml).toContain("ENL</span></strong> <i>Target Portal</i>");
    });

    it("returns undefined when portalId is missing, empty, invalid, or absent from telemetry", async () => {
        const resolve = createPortalTooltipResolver(mockRegistry, () => siteState);
        expect(await resolve({ dataset: { siteId: "site-1" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", portalId: "" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", portalId: "abc" } } as unknown as HTMLElement)).toBeUndefined();
        expect(await resolve({ dataset: { siteId: "site-1", portalId: "999" } } as unknown as HTMLElement)).toBeUndefined();
    });
});
