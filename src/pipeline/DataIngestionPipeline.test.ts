import { describe, test, expect, vi } from "vitest";
import { DataIngestionPipeline, type IngestionItem } from "./DataIngestionPipeline.js";
import { SiteStateMerger } from "./merging/SiteStateMerger.js";
import { createMockConfigRegistry } from "../../test/fixtures/MockConfigRegistry.js";
import type { SiteState } from "../sites/Site.js";

describe("DataIngestionPipeline", () => {
    // 2026-04-12T14:00:00Z[UTC] = 1776002400000 ms
    const siteStartTime = "2026-04-12T14:00:00Z[UTC]";
    const siteStartEpoch = 1776002400000;

    const registry = createMockConfigRegistry({
        siteId: "test-site",
        seasonId: "test-season",
        latE6: 10000000,
        lngE6: 20000000,
        startTime: siteStartTime,
        blueprints: {
            ornaments: {
                ap1: {
                    label: "Pre-event Ornament",
                    tags: ["pre-event"],
                    style: {},
                },
            },
        },
    });
    const candidateSites = registry.getSitesForSeason("test-season");

    test("should return an empty array when items list is empty", async () => {
        const pipeline = new DataIngestionPipeline(registry, candidateSites);
        const results = await pipeline.ingestBatch([]);
        expect(results).toEqual([]);
    });

    test("should ingest discovery items and establish portals on a site state", async () => {
        const pipeline = new DataIngestionPipeline(registry, candidateSites);

        const discoveryPayload = {
            siteId: "test-site",
            exportedAt: siteStartEpoch - 3600000,
            portals: [
                {
                    title: "Alpha Portal",
                    lat: 10,
                    lng: 20,
                    ornamentId: "ap1",
                },
            ],
        };

        const items: IngestionItem[] = [
            {
                filename: "ornamented-portals-2026.04.12.13.00.00.json",
                data: JSON.stringify(discoveryPayload),
            },
        ];

        const results = await pipeline.ingestBatch(items);
        expect(results).toHaveLength(1);

        const state = results[0]!;
        expect(state.metadata.siteId).toBe("test-site");
        expect(state.metadata.seasonId).toBe("test-season");

        // Verify telemetry
        const portals = Object.values(state.telemetry?.portals ?? {});
        expect(portals).toHaveLength(1);
        expect(portals[0]!.title).toBe("Alpha Portal");
        expect(portals[0]!.history?.[0]?.type).toBe("pre-event");

        // Verify analysis is populated with centroid at end of batch
        expect(state.analysis).toBeDefined();
        expect(state.analysis?.centroid).toEqual({ latE6: 10000000, lngE6: 20000000 });
    });

    test("should merge multiple items across stages in correct order (Discovery -> Targets -> Shards)", async () => {
        const pipeline = new DataIngestionPipeline(registry, candidateSites);

        // Discovery stage item
        const discoveryItem: IngestionItem = {
            filename: "ornamented-portals-2026.04.12.13.00.00.json",
            data: JSON.stringify({
                siteId: "test-site",
                portals: [
                    {
                        title: "Target Portal RES",
                        lat: 10,
                        lng: 20,
                        ornamentId: "ap1",
                    },
                ],
            }),
        };

        // Target portals stage item
        const targetItem: IngestionItem = {
            filename: "target-portals-2026.04.12.13.05.00.json",
            data: JSON.stringify({
                siteId: "test-site",
                exportedAt: siteStartEpoch - 3300000,
                artifact: [
                    {
                        id: "targetres",
                        name: "Target Resistance",
                        target: [
                            {
                                portalInfo: {
                                    title: "Target Portal RES",
                                    latE6: 10000000,
                                    lngE6: 20000000,
                                },
                                targetAlignment: "RESISTANCE",
                                observedAt: siteStartEpoch - 3300000,
                            },
                        ],
                    },
                ],
            }),
        };

        // Shard jump stage item during event (14:15)
        const shardJumpEpoch = siteStartEpoch + 15 * 60 * 1000;
        const shardItem: IngestionItem = {
            filename: "shard-jump-times-2026.04.12.14.15.00.json",
            data: JSON.stringify({
                artifact: [
                    {
                        id: "fragment1",
                        name: "Fragment 1",
                        fragment: [
                            {
                                id: "1",
                                history: [
                                    {
                                        moveTimeMs: String(shardJumpEpoch),
                                        reason: "spawn",
                                        originCapturerTeam: "NEUTRAL",
                                        destinationCapturerTeam: "RESISTANCE",
                                        destinationPortalInfo: {
                                            title: "Target Portal RES",
                                            latE6: 10000000,
                                            lngE6: 20000000,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        };

        // Provide items in reverse order to prove stage ordering guarantees Discovery -> Targets -> Shards
        const results = await pipeline.ingestBatch([shardItem, targetItem, discoveryItem]);

        expect(results).toHaveLength(1);
        const state = results[0]!;

        // Check portals contain both pre-event and target history
        const portals = Object.values(state.telemetry?.portals ?? {});
        expect(portals).toHaveLength(1);
        expect(portals[0]!.history?.map((h) => h.type)).toContain("pre-event");
        expect(portals[0]!.history?.map((h) => h.type)).toContain("target");

        // Check shards contain the fragment
        const shards = Object.values(state.telemetry?.shards ?? {});
        expect(shards).toHaveLength(1);
        expect(shards[0]!.history).toHaveLength(1);

        // Check comprehensive analysis completed
        expect(state.analysis).toBeDefined();
        expect(state.analysis?.centroid).toEqual({ latE6: 10000000, lngE6: 20000000 });
        expect(state.analysis?.shardPaths).toBeDefined();
    });

    test("should resolve existing states from external resolver if provided", async () => {
        const existingState: SiteState = {
            metadata: {
                siteId: "test-site",
                seasonId: "test-season",
                lastUpdated: 100,
            },
            telemetry: {
                portals: {
                    1: {
                        title: "Existing Portal",
                        latE6: 10000000,
                        lngE6: 20000000,
                        history: [
                            {
                                type: "pre-event",
                                timestamp: 100,
                                ornId: "ap1",
                            },
                        ],
                    },
                },
                shards: {},
            },
        };

        const resolveExistingState = vi.fn().mockResolvedValue(existingState);
        const merger = new SiteStateMerger();

        const pipeline = new DataIngestionPipeline(
            registry,
            candidateSites,
            resolveExistingState,
            merger
        );

        const items: IngestionItem[] = [
            {
                filename: "target-portals-2026.04.12.13.05.00.json",
                data: JSON.stringify({
                    siteId: "test-site",
                    exportedAt: siteStartEpoch - 3300000,
                    artifact: [
                        {
                            id: "targetres",
                            name: "Target Resistance",
                            target: [
                                {
                                    portalInfo: {
                                        title: "Existing Portal",
                                        latE6: 10000000,
                                        lngE6: 20000000,
                                    },
                                    targetAlignment: "RESISTANCE",
                                    observedAt: siteStartEpoch - 3300000,
                                },
                            ],
                        },
                    ],
                }),
            },
        ];

        const results = await pipeline.ingestBatch(items);
        expect(resolveExistingState).toHaveBeenCalledWith("test-site");
        expect(results).toHaveLength(1);

        const portals = Object.values(results[0]!.telemetry?.portals ?? {});
        expect(portals).toHaveLength(1);
        expect(portals[0]!.title).toBe("Existing Portal");
        expect(portals[0]!.history?.map((h) => h.type)).toContain("target");
    });

    test("should ingest live in-memory Capture objects directly without JSON stringification", async () => {
        const pipeline = new DataIngestionPipeline(registry, candidateSites);

        const liveSnapshot = {
            timestamp: siteStartEpoch - 24 * 60 * 60 * 1000,
            portals: [
                {
                    title: "Live Portal",
                    latE6: 10000000,
                    lngE6: 20000000,
                    guid: "guid-live-1",
                    ornaments: ["ap1"],
                },
            ],
        };

        const items: IngestionItem[] = [
            {
                filename: "map-snapshot-1776002400000.json",
                data: liveSnapshot,
            },
        ];

        const results = await pipeline.ingestBatch(items);
        expect(results).toHaveLength(1);

        const portals = Object.values(results[0]!.telemetry?.portals ?? {});
        expect(portals).toHaveLength(1);
        expect(portals[0]!.title).toBe("Live Portal");
        expect(portals[0]!.history?.[0]?.type).toBe("pre-event");
    });
});
