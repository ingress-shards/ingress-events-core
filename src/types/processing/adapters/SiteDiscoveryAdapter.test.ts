import { describe, test, expect } from "vitest";
import { SiteDiscoveryAdapter } from "./SiteDiscoveryAdapter.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";
import type { SiteDiscovery } from "../../data-files/SiteDiscovery.js";
import type { PreEventHistoryEntry } from "../../../sites/Portal.js";

describe("SiteDiscoveryAdapter", () => {
    const adapter = new SiteDiscoveryAdapter();

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
                                        rules: ["default_jump"],
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

    test("should parse and group discovery portal correctly with numeric IDs", () => {
        const input: SiteDiscovery = {
            siteId: "test-site",
            exportedAt: 1000,
            portals: [
                {
                    title: "Portal Discovery One",
                    lat: 10,
                    lng: 20,
                    ornamentId: "ap1"
                }
            ]
        };

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        expect(result.length).toBe(1);

        const record = result[0]!;
        expect(record.metadata.siteId).toBe("test-site");
        expect(record.metadata.seasonId).toBe("test-season");

        const obs = record.observations!;
        expect(obs.portals).toBeDefined();
        
        const portal = obs.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Portal Discovery One");
        expect(portal.history![0]!.type).toBe("pre-event");
        expect(portal.history![0]!.timestamp).toBe(1000);
        expect((portal.history![0]! as PreEventHistoryEntry).ornId).toBe("ap1");
    });
});
