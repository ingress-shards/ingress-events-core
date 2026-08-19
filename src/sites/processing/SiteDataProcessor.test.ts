import { describe, test, expect, vi } from "vitest";
import { SiteDataProcessor } from "./SiteDataProcessor.js";
import { SiteRecordMerger } from "./SiteRecordMerger.js";
import type { SiteRecord, SiteObservation } from "../Site.js";
import { EventConfigRegistry } from "../../config/EventConfigRegistry.js";
import type { DataObservationAdapter } from "../../types/processing/DataObservationAdapter.js";

describe("SiteDataProcessor", () => {
    const merger = new SiteRecordMerger();
    const processor = new SiteDataProcessor(merger);

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

    test("should orchestrate processing flow correctly", async () => {
        const mockInput = { someRawData: true };
        const mockObservations: SiteObservation = {
            portals: {
                "1": {
                    title: "Test Portal",
                    latE6: 10000000,
                    lngE6: 20000000,
                    history: []
                }
            },
            shards: {}
        };

        const mockSiteRecord: SiteRecord = {
            metadata: {
                siteId: "test-site",
                seasonId: "test-season",
                lastUpdated: 0
            },
            observations: mockObservations
        };

        // Mock adapter
        const mockAdapter: DataObservationAdapter<typeof mockInput> = {
            parseAndGroupObservations: vi.fn().mockReturnValue([mockSiteRecord])
        };

        const resolveRecord = vi.fn();

        const result = await processor.process({
            input: mockInput,
            adapter: mockAdapter,
            config: mockRegistry,
            resolveRecord
        });

        expect(mockAdapter.parseAndGroupObservations).toHaveBeenCalledWith(mockInput, mockRegistry);
        expect(resolveRecord).toHaveBeenCalledWith("test-site");
        expect(result.length).toBe(1);

        const savedRecord = result[0]!;
        expect(savedRecord.metadata.siteId).toBe("test-site");
        expect(savedRecord.metadata.seasonId).toBe("test-season");
        expect(savedRecord.analysis).toBeDefined();
        const portal = savedRecord.observations!.portals!["1"]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Test Portal");
    });
});
