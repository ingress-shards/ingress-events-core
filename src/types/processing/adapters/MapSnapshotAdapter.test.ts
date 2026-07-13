import { describe, test, expect } from "vitest";
import { MapSnapshotAdapter } from "./MapSnapshotAdapter.js";
import type { SiteGeocode } from "../../config/Geocode.js";
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

    const adapter = new MapSnapshotAdapter(blueprintOrnaments, 1000);

    const activeSites: SiteGeocode[] = [
        {
            id: "test-site",
            name: "Test Site",
            latE6: 10000000,
            lngE6: 20000000,
            eventType: "ANOMALY",
            startTime: "2026-06-18T12:00:00Z",
            timeZone: "UTC",
            countryCode: "US"
        }
    ];

    test("should parse snapshot ornaments correctly", () => {
        const input: MapSnapshot = {
            timestamp: 1000,
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

        const result = adapter.parseAndGroup(input, activeSites);
        console.log("--- MapSnapshotAdapter Input ---");
        console.log(JSON.stringify(input, undefined, 2));
        console.log("--- MapSnapshotAdapter Output ---");
        console.log(JSON.stringify(Object.fromEntries(result), undefined, 2));

        expect(result.has("test-site")).toBe(true);
        const obs = result.get("test-site")!;
        expect(obs.portals).toBeDefined();

        const portal = obs.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Snapshot Portal");
        expect(portal.guid).toBe("guid-1");
        expect(portal.history![0]!.type).toBe("pre-event");
        expect(portal.history![0]!.timestamp).toBe(1000);
        expect((portal.history![0]! as PreEventHistoryEntry).ornId).toBe("ap1");
    });
});
