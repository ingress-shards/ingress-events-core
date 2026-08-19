import { describe, test, expect } from "vitest";
import { SiteTargetPortalsAdapter } from "./SiteTargetPortalsAdapter.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";
import type { SiteTargetPortals } from "../../data-files/SiteTargetPortals.js";
import type { TargetHistoryEntry } from "../../../sites/Portal.js";

describe("SiteTargetPortalsAdapter", () => {
    const adapter = new SiteTargetPortalsAdapter();

    const activeSites = [
        {
            id: "test-site",
            name: "Test Site",
            latE6: 10000000,
            lngE6: 20000000,
            eventType: "ANOMALY" as const,
            startTime: "2026-06-18T12:00:00Z[UTC]",
            timeZone: "UTC",
            countryCode: "US"
        }
    ];

    const geocode = {
        seasons: [
            {
                id: "test-season",
                sites: activeSites
            }
        ]
    };

    const mockRegistry = new EventConfigRegistry({
        eventBlueprints: {
            events: { "ANOMALY": { label: "Anomaly" } },
            ornaments: {},
            shardMechanics: {},
            targetMechanics: {},
            scoring: {}
        } as any,
        seasonManifest: {
            seasons: [
                {
                    id: "test-season",
                    name: "Test Season",
                    year: 2026,
                    overviewUrl: "",
                    components: [
                        {
                            eventType: "ANOMALY",
                            startTime: "12:00",
                            mechanics: {
                                shards: {
                                    shardMechanics: "test-shard-mech",
                                    scoring: {
                                        wavePointAggregation: [[1, 2, 3, 4, 5, 6]]
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        },
        seasonGeocode: geocode
    });

    test("should parse and group target portals correctly", () => {
        const input: SiteTargetPortals = {
            siteId: "test-site",
            exportedAt: 1000,
            artifact: [
                {
                    id: "targetres",
                    name: "Target RES",
                    target: [
                        {
                            portalInfo: {
                                title: "Target Portal One",
                                latE6: 10000000,
                                lngE6: 20000000,
                            },
                            targetAlignment: "RESISTANCE",
                            observedAt: 1000
                        }
                    ]
                }
            ]
        };

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        console.log("--- SiteTargetPortalsAdapter Input ---");
        console.log(JSON.stringify(input, undefined, 2));
        console.log("--- SiteTargetPortalsAdapter Output ---");
        console.log(JSON.stringify(result, undefined, 2));

        expect(result.length).toBe(1);
        const record = result[0]!;
        expect(record.metadata.siteId).toBe("test-site");
        expect(record.metadata.seasonId).toBe("test-season");
        
        const obs = record.observations!;
        expect(obs.portals).toBeDefined();

        const portal = obs.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Target Portal One");
        expect(portal.history![0]!.type).toBe("target");
        expect(portal.history![0]!.timestamp).toBe(1000);
        expect((portal.history![0]! as TargetHistoryEntry).ornId).toBe("targetres");
    });
});
