import { describe, test, expect } from "vitest";
import { SiteTargetPortalsAdapter } from "./SiteTargetPortalsAdapter.js";
import type { SiteTargetPortals } from "../../types/observations/SiteTargetPortals.js";
import type { TargetHistoryEntry } from "../../sites/Portal.js";
import { createMockConfigRegistry } from "../../../test/fixtures/MockConfigRegistry.js";

describe("SiteTargetPortalsAdapter", () => {
    const mockRegistry = createMockConfigRegistry();
    const adapter = new SiteTargetPortalsAdapter(mockRegistry.getAllSites());

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

        const result = adapter.parseAndGroupTelemetry(input);

        expect(result.length).toBe(1);
        const state = result[0]!;
        expect(state.metadata.siteId).toBe("test-site");
        expect(state.metadata.seasonId).toBe("test-season");
        
        const tele = state.telemetry!;
        expect(tele.portals).toBeDefined();

        const portal = tele.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Target Portal One");
        expect(portal.history![0]!.type).toBe("target");
        expect(portal.history![0]!.timestamp).toBe(1000);
        expect((portal.history![0]! as TargetHistoryEntry).ornId).toBe("targetres");
    });
});
