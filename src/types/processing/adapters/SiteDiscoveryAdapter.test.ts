import { describe, test, expect } from "vitest";
import { SiteDiscoveryAdapter } from "./SiteDiscoveryAdapter.js";
import type { SiteDiscovery } from "../../data-files/SiteDiscovery.js";
import type { PreEventHistoryEntry } from "../../../sites/Portal.js";
import { createMockEventConfigRegistry } from "../../../../test/fixtures/MockConfigRegistry.js";

describe("SiteDiscoveryAdapter", () => {
    const adapter = new SiteDiscoveryAdapter();
    const mockRegistry = createMockEventConfigRegistry();

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
