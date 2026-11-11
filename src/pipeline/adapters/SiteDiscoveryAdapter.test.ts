import { describe, test, expect } from "vitest";
import { SiteDiscoveryAdapter } from "./SiteDiscoveryAdapter.js";
import type { SiteDiscovery } from "../../types/observations/SiteDiscovery.js";
import type { PreEventHistoryEntry } from "../../sites/Portal.js";
import { createMockConfigRegistry } from "../../../test/fixtures/MockConfigRegistry.js";

describe("SiteDiscoveryAdapter", () => {
    const mockRegistry = createMockConfigRegistry({
        extraSites: [
            {
                id: "extra-site",
                name: "Extra Site",
                latE6: 30000000,
                lngE6: 40000000,
                eventType: "ANOMALY",
                startTime: "2026-06-18T14:00:00Z[UTC]",
                timeZone: "UTC",
                countryCode: "US"
            }
        ]
    });
    const candidateSites = mockRegistry.getAllSites();
    const adapter = new SiteDiscoveryAdapter(candidateSites);

    test("should parse and group discovery portal correctly with numeric IDs when siteId is present", () => {
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

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(1);

        const state = result[0]!;
        expect(state.metadata.siteId).toBe("test-site");
        expect(state.metadata.seasonId).toBe("test-season");

        const tele = state.telemetry!;
        expect(tele.portals).toBeDefined();
        
        const portal = tele.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Portal Discovery One");
        expect(portal.history![0]!.type).toBe("pre-event");
        expect(portal.history![0]!.timestamp).toBe(1000 * 1000);
        expect((portal.history![0]! as PreEventHistoryEntry).ornId).toBe("ap1");
    });

    test("should spatially match portals to candidate sites when siteId is omitted", () => {
        const input: SiteDiscovery = {
            exportedAt: 1771949828,
            portals: [
                {
                    title: "Portal Near Test Site",
                    lat: 10.001,
                    lng: 20.001,
                    ornamentId: "ap1"
                },
                {
                    title: "Portal Near Extra Site",
                    lat: 30.002,
                    lng: 40.001,
                    ornamentId: "nl-1331-2026",
                    observedAt: 1771949828500
                },
                {
                    title: "Portal Far Away",
                    lat: 0,
                    lng: 0,
                    ornamentId: "orphan"
                }
            ]
        };

        const result = adapter.parseAndGroupTelemetry(input);
        expect(result.length).toBe(2);

        const testSiteState = result.find(r => r.metadata.siteId === "test-site");
        const extraSiteState = result.find(r => r.metadata.siteId === "extra-site");

        expect(testSiteState).toBeDefined();
        expect(extraSiteState).toBeDefined();

        const testPortal = Object.values(testSiteState!.telemetry!.portals!)[0]!;
        expect(testPortal.title).toBe("Portal Near Test Site");
        expect(testPortal.history![0]!.timestamp).toBe(1771949828 * 1000);

        const extraPortal = Object.values(extraSiteState!.telemetry!.portals!)[0]!;
        expect(extraPortal.title).toBe("Portal Near Extra Site");
        expect(extraPortal.history![0]!.timestamp).toBe(1771949828500);
        expect((extraPortal.history![0]! as PreEventHistoryEntry).ornId).toBe("nl-1331-2026");
    });
});
