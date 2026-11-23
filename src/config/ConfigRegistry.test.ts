import { describe, it, expect } from "vitest";
import { ConfigRegistry } from "./ConfigRegistry.js";
import { DEFAULT_SITE_DURATION_MINUTES } from "./SiteConfig.js";
import { findSiteByCoords } from "../common/Geo.js";
import type { EventBlueprints, SeasonGeocode, SeasonManifest } from "../types/index.js";
import { fromString as zdtFromString } from "temporal-polyfill/fns/ZonedDateTime";
import { getBasic } from "temporal-polyfill/fns/Calendar";

import realBlueprints from "../../conf/event_blueprints.json" with { type: "json" };
import realManifest from "../../conf/season_manifest.json" with { type: "json" };
import realGeocode from "../../gen/conf/season_geocode.json" with { type: "json" };

describe("ConfigRegistry", () => {
    const mockBlueprints: EventBlueprints = {
        events: {
            "ANOMALY": { label: "Anomaly Event" },
            "SKIRMISH": { label: "Shard Skirmish" },
            "INVESTIGATION": { label: "Shard Investigation" },
            "SINGULAR": { label: "Shard Singular" },
            "STORM": { label: "Shard Storm" },
            "SINGLE_SHARD": { label: "Single Shard" },
            "MULTIPLE_SHARDS": { label: "Multiple Shards" },
            "UNKNOWN": { label: "Unknown" }
        },
        ornaments: {},
        shardMechanics: {
            "test-shard-mech": {
                waves: [
                    { startOffset: 10, endOffset: 15, quantity: 5 },
                    { startOffset: 30, endOffset: 35, quantity: 10 }
                ],
                waveActions: [
                    { action: "spawn", time: 0 },
                    { action: "jump", time: 2 }
                ]
            }
        },
        targetMechanics: {
            "test-target-mech": {
                waves: [
                    { startOffset: 5, endOffset: 45, factionQuantity: { RES: 2, ENL: 2 } }
                ],
                waveActions: []
            }
        },
        linkScoringRules: {
            "default_jump": {
                label: "Jumps",
                points: 1
            }
        }
    };

    const mockManifest: SeasonManifest = {
        seasons: [
            {
                id: "season-1",
                name: "Season One",
                year: 2026,
                overviewUrl: "",
                events: [
                    {
                        eventType: "ANOMALY",
                        startTime: "12:00",
                        mechanics: {
                            shards: {
                                shardMechanics: "test-shard-mech",
                                targetMechanics: "test-target-mech",
                                jumpGroupSize: 3,
                                scoring: {
                                    linkRules: ["default_jump"],
                                    wavePointAggregation: [[1, 2, 3, 4, 5, 6]]
                                }
                            }
                        }
                    }
                ]
            }
        ]
    };

    const mockGeocode: SeasonGeocode = {
        seasons: [
            {
                id: "season-1",
                sites: [
                    {
                        id: "site-london",
                        name: "London",
                        latE6: 51500000,
                        lngE6: -100000,
                        eventType: "ANOMALY",
                        startTime: "2026-06-01T12:00:00Z[UTC]",
                        timeZone: "Europe/London",
                        countryCode: "GB"
                    }
                ]
            }
        ]
    };

    it("should build season configs and calculate action schedules correctly", () => {
        const registry = new ConfigRegistry(
            mockBlueprints,
            mockManifest,
            mockGeocode
        );

        const season = registry.getSeasonMetadata("season-1");
        expect(season).toBeDefined();
        expect(season?.name).toBe("Season One");

        const londonConfig = registry.getSiteConfig("site-london");
        expect(londonConfig).toBeDefined();
        expect(londonConfig?.geocode.name).toBe("London");
        expect(londonConfig?.seasonId).toBe("season-1");

        // London startTime: "2026-06-01T12:00:00Z[UTC]" -> 1777723200000 ms
        const startMs = zdtFromString("2026-06-01T12:00:00Z[UTC]", getBasic).epochMilliseconds;
        const schedule = londonConfig!.timeline;
        expect(schedule.start).toBe(startMs);
        expect(schedule.preEventCutoff).toBe(startMs - 2 * 60 * 60 * 1000);
        expect(schedule.jumpGroupSize).toBe(3);
        
        // Final wave endOffset is 45 mins (from target-mech, Math.max of 35 and 45)
        expect(schedule.end).toBe(startMs + 45 * 60 * 1000);
        // Active gameplay duration is 33 mins (last wave start 30 + last jump 2 + 1)
        expect(schedule.activeDurationMinutes).toBe(33);

        // Shard waves (2 waves):
        expect(schedule.shards.length).toBe(2);
        
        // Wave 1:
        const w1 = schedule.shards[0]!;
        expect(w1.waveNumber).toBe(1);
        expect(w1.start).toBe(startMs + 10 * 60 * 1000);
        expect(w1.end).toBe(startMs + 15 * 60 * 1000);
        expect(w1.expectedShards).toBe(5);
        expect(w1.shardsActions).toBeDefined();
        expect(w1.shardsActions!.length).toBe(2);
        expect(w1.shardsActions![0]!.action).toBe("spawn");
        expect(w1.shardsActions![0]!.time).toBe(w1.start + 0);
        expect(w1.shardsActions![1]!.action).toBe("jump");
        expect(w1.shardsActions![1]!.time).toBe(w1.start + 2 * 60 * 1000);

        // Wave 2:
        const w2 = schedule.shards[1]!;
        expect(w2.expectedShards).toBe(10);

        // List queries
        expect(registry.getAllSites().length).toBe(1);
        expect(registry.getSitesForSeason("season-1").length).toBe(1);
        expect(registry.getAllSeasonIds()).toEqual(["season-1"]);
        expect(registry.getDefaultSeasonId()).toBe("season-1");
    });

    it("should find sites by coordinates chronologically using findSiteByCoords from Geo.ts", () => {
        const registry = new ConfigRegistry(
            mockBlueprints,
            mockManifest,
            mockGeocode
        );

        const startMs = zdtFromString("2026-06-01T12:00:00Z[UTC]", getBasic).epochMilliseconds;
        const endMs = startMs + 45 * 60 * 1000;

        // Coordinates within London range
        const lat = 51500000;
        const lng = -100000;

        // 1. Pre-event (upcoming event)
        const matchPre = findSiteByCoords(registry.getAllSites(), lat, lng, startMs - 5 * 24 * 60 * 60 * 1000);
        expect(matchPre?.geocode.id).toBe("site-london");
        expect(matchPre?.seasonId).toBe("season-1");

        // 2. Active event (during the event)
        const matchActive = findSiteByCoords(registry.getAllSites(), lat, lng, startMs + 20 * 60 * 1000);
        expect(matchActive?.geocode.id).toBe("site-london");

        // 3. Just after the event (within 60 mins post-event window)
        const matchRecent = findSiteByCoords(registry.getAllSites(), lat, lng, endMs + 30 * 60 * 1000);
        expect(matchRecent?.geocode.id).toBe("site-london");

        // 4. Stale/Expired past event (> 60 mins after end)
        const matchExpired = findSiteByCoords(registry.getAllSites(), lat, lng, endMs + 90 * 60 * 1000);
        expect(matchExpired).toBeUndefined();

        // 5. Out of range coordinates
        const nearMissLat = 51810000;
        const outOfRange = findSiteByCoords(registry.getAllSites(), nearMissLat, lng, startMs);
        expect(outOfRange).toBeUndefined();
    });

    it("should throw a detailed error if shard quantity is missing and cannot be determined", () => {
        const invalidBlueprints: EventBlueprints = {
            ...mockBlueprints,
            shardMechanics: {
                "invalid-mech": {
                    waves: [
                        { startOffset: 0, endOffset: 15 } // missing quantity!
                    ],
                    waveActions: []
                }
            }
        };

        const invalidManifest: SeasonManifest = {
            seasons: [
                {
                    id: "invalid-season",
                    name: "Invalid Season",
                    year: 2026,
                    overviewUrl: "",
                    events: [
                        {
                            eventType: "ANOMALY",
                            startTime: "12:00",
                            mechanics: {
                                shards: {
                                    shardMechanics: "invalid-mech",
                                    scoring: {}
                                }
                            }
                        }
                    ]
                }
            ]
        };

        const invalidGeocode: SeasonGeocode = {
            seasons: [
                {
                    id: "invalid-season",
                    sites: [
                        {
                            id: "site-broken",
                            name: "Broken Site",
                            latE6: 10000000,
                            lngE6: 20000000,
                            eventType: "ANOMALY",
                            startTime: "2026-06-01T12:00:00Z[UTC]",
                            timeZone: "UTC",
                            countryCode: "GB"
                        }
                    ]
                }
            ]
        };

        expect(() => new ConfigRegistry(invalidBlueprints, invalidManifest, invalidGeocode)).toThrow(
            /Invalid configuration: Missing shard quantity for wave 1 of 1 at site 'site-broken' \(Broken Site\) in season 'invalid-season'/
        );
    });

    it("should output the resulting registry for the Jersey City Orion anomaly config", () => {
        const registry = new ConfigRegistry(
            realBlueprints as EventBlueprints,
            realManifest as SeasonManifest,
            realGeocode as SeasonGeocode
        );

        const pragueConfig = registry.getSiteConfig("2026-orion-jersey-city");
        expect(pragueConfig).toBeDefined();
        
    });

    it("should return configured active site duration or default fallback duration", () => {
        const registry = new ConfigRegistry(
            realBlueprints as EventBlueprints,
            realManifest as SeasonManifest,
            realGeocode as SeasonGeocode
        );

        // Configured site (6w_30m_4j: lastWaveStart 152 + lastJumpOffset 23 + 1 = 176)
        const configuredDuration = registry.getSiteActiveDurationMinutes("2026-orion-jersey-city");
        expect(configuredDuration).toBe(176);
        expect(configuredDuration).toBe(registry.getSiteConfig("2026-orion-jersey-city")!.timeline.activeDurationMinutes);

        // Unknown / unconfigured site fallback
        const fallbackDuration = registry.getSiteActiveDurationMinutes("unknown-site-id");
        expect(fallbackDuration).toBe(DEFAULT_SITE_DURATION_MINUTES);
        expect(fallbackDuration).toBe(240);
    });

    it("should compute activeDurationMinutes excluding stationary despawn period for Cygnus Shard Storm", () => {
        const registry = new ConfigRegistry(
            realBlueprints as EventBlueprints,
            realManifest as SeasonManifest,
            realGeocode as SeasonGeocode
        );

        const perthConfig = registry.getSiteConfig("2026-cygnus-perth");
        expect(perthConfig).toBeDefined();
        // 1w_420m_18j: wave starts at +0m, final jump at +169m -> active duration = 170 min (16:50 local)
        expect(perthConfig!.timeline.activeDurationMinutes).toBe(170);
        expect(registry.getSiteActiveDurationMinutes("2026-cygnus-perth")).toBe(170);
        // Full lifecycle end and wave end remain at despawn (+420m / 21:00 local)
        expect(perthConfig!.timeline.end).toBe(perthConfig!.timeline.start + 420 * 60 * 1000);
        expect(perthConfig!.timeline.shards[0]!.end).toBe(perthConfig!.timeline.start + 420 * 60 * 1000);
    });
});
