import { describe, test, expect } from "vitest";
import { SiteDiscoveryAdapter } from "./SiteDiscoveryAdapter.js";
import type { SiteGeocode } from "../../config/Geocode.js";
import type { SiteDiscovery } from "../../data-files/SiteDiscovery.js";
import type { PreEventHistoryEntry } from "../../../sites/Portal.js";

describe("SiteDiscoveryAdapter", () => {
    const adapter = new SiteDiscoveryAdapter();

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

        const result = adapter.parseAndGroup(input, activeSites);
        expect(result.has("test-site")).toBe(true);

        const obs = result.get("test-site")!;
        expect(obs.portals).toBeDefined();
        
        const portal = obs.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Portal Discovery One");
        expect(portal.history![0]!.type).toBe("pre-event");
        expect(portal.history![0]!.timestamp).toBe(1000);
        expect((portal.history![0]! as PreEventHistoryEntry).ornId).toBe("ap1");
    });
});
