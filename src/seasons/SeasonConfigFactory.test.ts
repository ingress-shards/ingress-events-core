import { describe, test, expect } from "vitest";
import { buildSeasonConfig } from "./SeasonConfigFactory.js";
import type { EventBlueprints, SeasonManifest, SeasonGeocode } from "../types/index.js";

// Import real data for the "golden path" test
import manifestJson from "../../conf/season_manifest.json" with { type: "json" };
import blueprintsJson from "../../conf/event_blueprints.json" with { type: "json" };
import geocodeJson from "../../dist/conf/season_geocode.json" with { type: "json" };

describe("config Builder", () => {
    test("buildSeasonConfig correctly merges real manifest and geocode data", () => {
        const result = buildSeasonConfig({
            eventBlueprints: blueprintsJson as EventBlueprints,
            seasonManifest: manifestJson as SeasonManifest,
            seasonGeocode: geocodeJson as SeasonGeocode,
        });

        // Check if we have some results (2024-sharedmem should be there in real data)
        expect(result["2024-sharedmem"]).toBeDefined();
        expect(result["2024-sharedmem"]!.metadata.name).toBe("Shared Memories");

        // Singapore is a known site in 2024-sharedmem
        const singaporeConfig = result["2024-sharedmem"]!.sites["2024-sharedmem-singapore"];
        expect(singaporeConfig).toBeDefined();
        expect(singaporeConfig!.geocode.name).toBe("Singapore");
        expect(singaporeConfig!.shardMechanics).toBeDefined();
        // 2024-sharedmem ANOMALY component has targetMechanics: "1w_241m"
        expect(singaporeConfig!.targetMechanics).toBeDefined();
    });

    test("buildSeasonConfig handles shardCounts overrides for specific sites", () => {
        const mockBlueprints: EventBlueprints = {
            events: {} as any,
            ornaments: {},
            shardMechanics: {
                "6w_base": {
                    waves: [
                        { startOffset: 0, endOffset: 10, quantity: 5 },
                        { startOffset: 11, endOffset: 20, quantity: 5 },
                    ],
                    waveActions: [],
                },
            },
            targetMechanics: {},
            scoring: {},
        };

        const mockManifest: SeasonManifest = {
            seasons: [
                {
                    id: "mock-season",
                    name: "Mock Season",
                    year: 2026,
                    overviewUrl: "",
                    components: [
                        {
                            eventType: "ANOMALY",
                            startTime: "14:00",
                            shardMechanics: "6w_base",
                            schedule: [
                                {
                                    date: "2026-01-01",
                                    sites: [
                                        {
                                            name: "Override Site",
                                            latE6: 10000000,
                                            lngE6: 10000000,
                                            shardCounts: [10, 20],
                                        },
                                        { name: "Default Site", latE6: 20000000, lngE6: 20000000 },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const mockGeocode: SeasonGeocode = {
            seasons: [
                {
                    id: "mock-season",
                    sites: [
                        {
                            id: "s1",
                            name: "Override Site",
                            latE6: 10000000,
                            lngE6: 10000000,
                            eventType: "ANOMALY",
                            startTime: "2026-02-28T14:00:00[America/New_York]",
                            timeZone: "America/New_York",
                            countryCode: "US",
                        },
                        {
                            id: "s2",
                            name: "Default Site",
                            latE6: 20000000,
                            lngE6: 20000000,
                            eventType: "ANOMALY",
                            startTime: "2026-02-28T14:00:00[America/New_York]",
                            timeZone: "America/New_York",
                            countryCode: "US",
                        },
                    ],
                },
            ],
        };

        const result = buildSeasonConfig({
            eventBlueprints: mockBlueprints,
            seasonManifest: mockManifest,
            seasonGeocode: mockGeocode,
        });

        const overrideSite = result["mock-season"]!.sites.s1;
        const defaultSite = result["mock-season"]!.sites.s2;

        // 1. Override site should have custom quantities
        expect(overrideSite?.shardMechanics?.waves[0]?.quantity).toBe(10);
        expect(overrideSite?.shardMechanics?.waves[1]?.quantity).toBe(20);

        // 2. Default site should have original quantities from blueprint
        expect(defaultSite?.shardMechanics?.waves[0]?.quantity).toBe(5);
        expect(defaultSite?.shardMechanics?.waves[1]?.quantity).toBe(5);

        // 3. Ensure we didn't accidentally mutate the original shared blueprint object
        expect(mockBlueprints.shardMechanics["6w_base"]!.waves[0]!.quantity).toBe(5);
    });

    test("buildSeasonConfig skips season with no geocode data", () => {
        const mockManifest: SeasonManifest = {
            seasons: [{ id: "missing-season", name: "Missing", year: 2026, overviewUrl: "", components: [] }],
        };
        const mockGeocode: SeasonGeocode = { seasons: [] };

        const result = buildSeasonConfig({
            eventBlueprints: { shardMechanics: {}, targetMechanics: {}, events: {}, ornaments: {}, scoring: {} } as any,
            seasonManifest: mockManifest,
            seasonGeocode: mockGeocode,
        });

        expect(result["missing-season"]).toBeUndefined();
    });

    test("buildSeasonConfig handles sites that don't match any component in manifest", () => {
        const mockManifest: SeasonManifest = {
            seasons: [{ id: "season-id", name: "Name", year: 2026, overviewUrl: "", components: [] }],
        };
        const mockGeocode: SeasonGeocode = {
            seasons: [
                {
                    id: "season-id",
                    sites: [
                        {
                            id: "site-id",
                            name: "Solo Site",
                            latE6: 0,
                            lngE6: 0,
                            eventType: "STORM",
                            startTime: "2026-02-28T14:00:00[America/New_York]",
                            timeZone: "America/New_York",
                            countryCode: "US",
                        },
                    ],
                },
            ],
        };

        const result = buildSeasonConfig({
            eventBlueprints: { shardMechanics: {}, targetMechanics: {}, events: {}, ornaments: {}, scoring: {} } as any,
            seasonManifest: mockManifest,
            seasonGeocode: mockGeocode,
        });

        const siteConfig = result["season-id"]!.sites["site-id"];
        expect(siteConfig).toBeDefined();
        expect(siteConfig!.shardMechanics).toBeUndefined();
        expect(siteConfig!.targetMechanics).toBeUndefined();
        expect(siteConfig!.geocode.name).toBe("Solo Site");
    });
});
