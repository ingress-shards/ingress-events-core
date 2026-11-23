import { describe, it, expect } from "vitest";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteState } from "../../sites/Site.js";
import { resolveFactionWaveContext, resolveSiteContext, resolveWaveContext } from "./TooltipContext.js";

const mockRegistry = {
    blueprints: {},
    getSiteConfig: (siteId: string) =>
        siteId === "site-1"
            ? {
                seasonId: "season-1",
                geocode: { id: "site-1", name: "London", eventType: "SKIRMISH", timeZone: "Europe/London" },
                timeline: {
                    start: 1_780_315_200_000,
                    activeDurationMinutes: 180,
                    jumpGroupSize: 2,
                    shards: [{ waveNumber: 1, start: 1_780_315_200_000, end: 1_780_317_000_000, expectedShards: 3, shardsActions: [] }],
                },
            }
            : undefined,
    getSeasonMetadata: (seasonId: string) =>
        seasonId === "season-1"
            ? { id: "season-1", events: [{ eventType: "SKIRMISH", mechanics: {} }] }
            : undefined,
} as unknown as ConfigRegistry;

const sampleState: SiteState = {
    metadata: { siteId: "site-1", seasonId: "season-1", lastUpdated: 0 },
    analysis: {
        waves: {
            1: {
                points: { total: { RES: 4, ENL: 2 } },
                shardJumpWindows: [{ jumpNumber: 1, scheduledStart: 100, actualEnd: 110, actionCount: 1 }],
            },
        },
    },
};

describe("TooltipContext resolvers", () => {
    it("resolves site context when siteState is absent and rejects missing or unknown siteId", async () => {
        const trigger = { dataset: { siteId: "site-1" } } as unknown as HTMLElement;
        const context = await resolveSiteContext(trigger, mockRegistry, () => Promise.resolve(undefined));
        expect(context).toBeDefined();
        expect(context?.siteState).toBeUndefined();
        expect(context?.siteConfig.geocode.timeZone).toBe("Europe/London");
        expect(context?.siteConfig.timeline.jumpGroupSize).toBe(2);

        expect(await resolveSiteContext({ dataset: {} } as unknown as HTMLElement, mockRegistry, () => undefined)).toBeUndefined();
        expect(await resolveSiteContext({ dataset: { siteId: "missing" } } as unknown as HTMLElement, mockRegistry, () => undefined)).toBeUndefined();
    });

    it("resolves wave context and rejects invalid wave dataset or missing state", async () => {
        const context = await resolveWaveContext({ dataset: { siteId: "site-1", wave: "1" } } as unknown as HTMLElement, mockRegistry, () => sampleState);
        expect(context?.waveNum).toBe(1);
        expect(context?.waveState).toBe(sampleState.analysis?.waves[1]);

        expect(await resolveWaveContext({ dataset: { siteId: "site-1" } } as unknown as HTMLElement, mockRegistry, () => sampleState)).toBeUndefined();
        expect(await resolveWaveContext({ dataset: { siteId: "site-1", wave: "" } } as unknown as HTMLElement, mockRegistry, () => sampleState)).toBeUndefined();
        expect(await resolveWaveContext({ dataset: { siteId: "site-1", wave: "abc" } } as unknown as HTMLElement, mockRegistry, () => sampleState)).toBeUndefined();
        expect(await resolveWaveContext({ dataset: { siteId: "site-1", wave: "2" } } as unknown as HTMLElement, mockRegistry, () => sampleState)).toBeUndefined();
        expect(await resolveWaveContext({ dataset: { siteId: "site-1", wave: "1" } } as unknown as HTMLElement, mockRegistry, () => undefined)).toBeUndefined();
    });

    it("resolves faction wave context for valid factions and rejects missing or invalid faction", async () => {
        const resistanceContext = await resolveFactionWaveContext({ dataset: { siteId: "site-1", wave: "1", faction: "RES" } } as unknown as HTMLElement, mockRegistry, () => sampleState);
        expect(resistanceContext?.faction).toBe("RES");

        const enlightenedContext = await resolveFactionWaveContext({ dataset: { siteId: "site-1", wave: "1", faction: "ENL" } } as unknown as HTMLElement, mockRegistry, () => sampleState);
        expect(enlightenedContext?.faction).toBe("ENL");

        expect(await resolveFactionWaveContext({ dataset: { siteId: "site-1", wave: "1", faction: "NEU" } } as unknown as HTMLElement, mockRegistry, () => sampleState)).toBeUndefined();
        expect(await resolveFactionWaveContext({ dataset: { siteId: "site-1", wave: "1" } } as unknown as HTMLElement, mockRegistry, () => sampleState)).toBeUndefined();
    });
});
