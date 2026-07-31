import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";
import type { SiteRecord } from "../Site.js";
import type { SiteId } from "../../common/Identifiers.js";
import type { DataObservationAdapter } from "../../types/processing/DataObservationAdapter.js";
import type { SiteRecordMerger } from "./SiteRecordMerger.js";
import { SiteRecordAnalyser } from "./SiteRecordAnalyser.js";

export class SiteDataProcessor {
    constructor(private merger: SiteRecordMerger) {}

    public async process<T>({
        input,
        adapter,
        config,
        resolveRecord,
    }: {
        input: T;
        adapter: DataObservationAdapter<T>;
        config: EventConfigRegistry;
        resolveRecord: (siteId: SiteId) => Promise<SiteRecord | undefined> | SiteRecord | undefined;
    }): Promise<SiteRecord[]> {
        const newSiteRecords = adapter.parseAndGroupObservations(input, config);
        const processedRecords: SiteRecord[] = [];

        for (const incomingRecord of newSiteRecords) {
            const siteId = incomingRecord.metadata.siteId;
            const existingRecord = await resolveRecord(siteId);

            const baseRecord: SiteRecord = existingRecord ?? {
                metadata: incomingRecord.metadata,
                observations: { portals: {}, shards: {} }
            };

            const { record: updatedRecord, hasChanged } = this.merger.merge(
                baseRecord, 
                incomingRecord.observations ?? {},
                config
            );

            if (hasChanged || !existingRecord) {
                updatedRecord.analysis = SiteRecordAnalyser.analyze(updatedRecord, config);
                processedRecords.push(updatedRecord);
            }
        }

        return processedRecords;
    }
}
