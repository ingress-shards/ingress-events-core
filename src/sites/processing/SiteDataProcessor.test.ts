import { describe, test, expect, vi } from "vitest";
import { SiteDataProcessor } from "./SiteDataProcessor.js";
import { SiteRecordMerger } from "./SiteRecordMerger.js";
import type { SiteRecord, SiteObservation } from "../Site.js";
import type { SiteGeocode } from "../../types/config/Geocode.js";
import type { DataObservationAdapter } from "../../types/processing/DataObservationAdapter.js";

describe("SiteDataProcessor", () => {
    const merger = new SiteRecordMerger();
    const processor = new SiteDataProcessor(merger);

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

        // Mock adapter
        const mockAdapter: DataObservationAdapter<typeof mockInput> = {
            parseAndGroup: vi.fn().mockReturnValue(new Map([["test-site", mockObservations]]))
        };

        const resolveRecord = vi.fn();
        const saveRecord = vi.fn();

        await processor.process({
            input: mockInput,
            adapter: mockAdapter,
            activeSites,
            resolveRecord,
            saveRecord
        });

        expect(mockAdapter.parseAndGroup).toHaveBeenCalledWith(mockInput, activeSites);
        expect(resolveRecord).toHaveBeenCalledWith("test-site");
        expect(saveRecord).toHaveBeenCalled();

        const savedRecord: SiteRecord = saveRecord.mock.calls[0]![1];
        expect(savedRecord.metadata.geocode.id).toBe("test-site");
        const portal = savedRecord.observations!.portals!["1"]!;
        expect(portal).toBeDefined();
        expect(portal.title).toBe("Test Portal");
    });
});
