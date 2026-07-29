import { describe, test, expect } from "vitest";
import { MapSnapshotAdapter } from "./MapSnapshotAdapter.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";
import type { MapSnapshot } from "../../capture/MapSnapshot.js";
import type { Ornament } from "../../config/EventBlueprints.js";
import type { PreEventHistoryEntry } from "../../../sites/Portal.js";

describe("MapSnapshotAdapter", () => {
    const blueprintOrnaments: Record<string, Ornament> = {
        "ap1": {
            label: "Pre-event Ornament",
            tags: ["pre-event"],
            style: {}
        }
    };

    const eventTime = Date.parse("2026-06-18T12:00:00Z");
    const snapshotTime = eventTime - 24 * 60 * 60 * 1000; // 1 day before

    const adapter = new MapSnapshotAdapter(blueprintOrnaments, snapshotTime);

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

    test("should parse snapshot ornaments correctly", () => {
        const input: MapSnapshot = {
            timestamp: snapshotTime,
            portals: [
                {
                    guid: "guid-1",
                    title: "Snapshot Portal",
                    latE6: 10000000,
                    lngE6: 20000000,
                    ornaments: ["ap1"]
                }
            ]
        };

        const result = adapter.parseAndGroupObservations(input, mockRegistry);
        console.log("--- MapSnapshotAdapter Input ---");
        console.log(JSON.stringify(input, undefined, 2));
        console.log("--- MapSnapshotAdapter Output ---");
        console.log(JSON.stringify(result, undefined, 2));

        expect(result.length).toBe(1);
        const record = result[0]!;
        expect(record.metadata.siteId).toBe("test-site");
        expect(record.metadata.seasonId).toBe("test-season");
        
        const obs = record.observations!;
        expect(obs.portals).toBeDefined();

        const portal = obs.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Snapshot Portal");
        expect(portal.guid).toBe("guid-1");
        expect(portal.history![0]!.type).toBe("pre-event");
        expect(portal.history![0]!.timestamp).toBe(snapshotTime);
        expect((portal.history![0]! as PreEventHistoryEntry).ornId).toBe("ap1");
    });

    test("should ignore pre-event ornaments if snapshot is after preEventCutoff", () => {
        // Mock getSiteConfig to return a cutoff in the past
        const originalGet = mockRegistry.getSiteConfig;
        mockRegistry.getSiteConfig = ((siteId: string) => {
            return {
                geocode: { id: siteId },
                timeline: {
                    preEventCutoff: snapshotTime - 1000 // cutoff is 1 second BEFORE the snapshot
                }
            };
        }) as any;

        try {
            const input: MapSnapshot = {
                timestamp: snapshotTime,
                portals: [
                    {
                        guid: "guid-1",
                        title: "Snapshot Portal",
                        latE6: 10000000,
                        lngE6: 20000000,
                        ornaments: ["ap1"]
                    }
                ]
            };

            const result = adapter.parseAndGroupObservations(input, mockRegistry);
            // Should be empty because the site was ignored due to cutoff
            expect(result.length).toBe(0);
        } finally {
            // Restore original method
            mockRegistry.getSiteConfig = originalGet;
        }
    });
});
