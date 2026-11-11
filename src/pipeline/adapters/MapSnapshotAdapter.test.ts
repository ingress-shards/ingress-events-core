import { describe, test, expect } from "vitest";
import { MapSnapshotAdapter } from "./MapSnapshotAdapter.js";
import type { MapSnapshot } from "../../types/observations/MapSnapshot.js";
import type { Ornament } from "../../types/config/EventBlueprints.js";
import type { PreEventHistoryEntry } from "../../sites/Portal.js";
import { createMockConfigRegistry } from "../../../test/fixtures/MockConfigRegistry.js";

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

    const mockRegistry = createMockConfigRegistry();
    const adapter = new MapSnapshotAdapter(blueprintOrnaments, mockRegistry.getAllSites());

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

        const result = adapter.parseAndGroupTelemetry(input);

        expect(result.length).toBe(1);
        const state = result[0]!;
        expect(state.metadata.siteId).toBe("test-site");
        expect(state.metadata.seasonId).toBe("test-season");
        
        const tele = state.telemetry!;
        expect(tele.portals).toBeDefined();

        const portal = tele.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Snapshot Portal");
        expect(portal.guid).toBe("guid-1");
        expect(portal.history![0]!.type).toBe("pre-event");
        expect(portal.history![0]!.timestamp).toBe(snapshotTime);
        expect((portal.history![0]! as PreEventHistoryEntry).ornId).toBe("ap1");
    });

    test("should ignore pre-event ornaments if snapshot is after preEventCutoff", () => {
        const sitesWithPastCutoff = mockRegistry.getAllSites().map(site => ({
            ...site,
            timeline: {
                ...site.timeline,
                preEventCutoff: snapshotTime - 1000 // cutoff is 1 second BEFORE the snapshot
            }
        }));
        const cutoffAdapter = new MapSnapshotAdapter(blueprintOrnaments, sitesWithPastCutoff);

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

        const result = cutoffAdapter.parseAndGroupTelemetry(input);
        // Should be empty because the site was ignored due to cutoff
        expect(result.length).toBe(0);
    });
});
