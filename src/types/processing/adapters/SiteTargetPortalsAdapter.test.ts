import { describe, test, expect } from "vitest";
import { SiteTargetPortalsAdapter } from "./SiteTargetPortalsAdapter.js";
import type { SiteGeocode } from "../../config/Geocode.js";
import type { SiteTargetPortals } from "../../data-files/SiteTargetPortals.js";
import type { TargetHistoryEntry } from "../../../sites/Portal.js";

describe("SiteTargetPortalsAdapter", () => {
    const adapter = new SiteTargetPortalsAdapter();

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

        const result = adapter.parseAndGroup(input, activeSites);
        console.log("--- SiteTargetPortalsAdapter Input ---");
        console.log(JSON.stringify(input, undefined, 2));
        console.log("--- SiteTargetPortalsAdapter Output ---");
        console.log(JSON.stringify(Object.fromEntries(result), undefined, 2));

        expect(result.has("test-site")).toBe(true);
        const obs = result.get("test-site")!;
        expect(obs.portals).toBeDefined();

        const portal = obs.portals![1]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Target Portal One");
        expect(portal.history![0]!.type).toBe("target");
        expect(portal.history![0]!.timestamp).toBe(1000);
        expect((portal.history![0]! as TargetHistoryEntry).ornId).toBe("targetres");
    });
});
