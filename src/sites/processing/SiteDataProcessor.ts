import type { SiteId } from "../../common/Identifiers.js";
import type { SiteGeocode } from "../../types/config/Geocode.js";
import type { SiteRecord } from "../Site.js";
import type { DataObservationAdapter } from "../../types/processing/DataObservationAdapter.js";
import type { SiteRecordMerger } from "./SiteRecordMerger.js";

export class SiteDataProcessor {
    constructor(private merger: SiteRecordMerger) {}

    public async process<T>({
        input,
        adapter,
        activeSites,
        resolveRecord,
        saveRecord,
    }: {
        input: T;
        adapter: DataObservationAdapter<T>;
        activeSites: SiteGeocode[];
        resolveRecord: (siteId: SiteId) => Promise<SiteRecord | undefined> | SiteRecord | undefined;
        saveRecord: (siteId: SiteId, record: SiteRecord) => Promise<void> | void;
    }): Promise<void> {
        const grouped = adapter.parseAndGroup(input, activeSites);

        for (const [siteId, incomingObs] of grouped.entries()) {
            const existingRecord = await resolveRecord(siteId);
            
            const siteGeocode = activeSites.find(s => s.id === siteId);
            if (!siteGeocode) continue;

            const baseRecord: SiteRecord = existingRecord ?? {
                lastUpdated: 0,
                metadata: { geocode: siteGeocode, schedule: {} }
            };

            const updatedRecord = this.merger.merge(baseRecord, incomingObs);
            await saveRecord(siteId, updatedRecord);
        }
    }
}
