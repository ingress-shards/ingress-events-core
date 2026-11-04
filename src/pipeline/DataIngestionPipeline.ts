import type { EventConfigRegistry } from "../config/EventConfigRegistry.js";
import type { SiteRecord } from "../sites/Site.js";
import type { SiteId } from "../common/Identifiers.js";
import type {
    DataObservationAdapter,
    IngestionItem,
} from "./adapters/DataObservationAdapter.js";
import { SiteRecordMerger } from "./merging/SiteRecordMerger.js";
import type { SiteConfig } from "../config/SiteConfig.js";
import {
    MapSnapshotAdapter,
    ShardJumpCaptureAdapter,
    SiteDiscoveryAdapter,
    SiteTargetPortalsAdapter,
} from "./adapters/index.js";
import { parseTimestampFromFilename } from "../common/Date.js";
import { SiteRecordAnalyser } from "./analysis/SiteRecordAnalyser.js";

export type { IngestionItem, IngestionPayload } from "./adapters/DataObservationAdapter.js";

export class DataIngestionPipeline {
    private readonly ingestionStages: DataObservationAdapter<any>[];
    private readonly sitesById: Map<SiteId, SiteConfig>;
    private readonly analyser: SiteRecordAnalyser;

    constructor(
        private readonly registry: EventConfigRegistry,
        candidateSites: SiteConfig[],
        private readonly resolveExistingRecord?: (siteId: SiteId) => Promise<SiteRecord | undefined>,
        private readonly merger: SiteRecordMerger = new SiteRecordMerger()
    ) {
        this.sitesById = new Map(candidateSites.map((s) => [s.geocode.id, s]));
        this.analyser = new SiteRecordAnalyser(this.registry);
        this.ingestionStages = [
            new SiteDiscoveryAdapter(candidateSites),
            new MapSnapshotAdapter(this.registry.blueprints.ornaments, candidateSites),
            new SiteTargetPortalsAdapter(candidateSites),
            new ShardJumpCaptureAdapter(candidateSites),
        ];
    }

    private async consolidateSiteRecords(
        ingestedSiteRecords: SiteRecord[],
        records: Map<SiteId, SiteRecord>
    ): Promise<void> {
        for (const incomingRecord of ingestedSiteRecords) {
            const siteId = incomingRecord.metadata.siteId;
            const existingRecord = records.get(siteId) ?? await this.resolveExistingRecord?.(siteId);
            if (existingRecord) {
                const siteConfig = this.sitesById.get(siteId);
                const { record: updatedRecord, hasChanged } = this.merger.merge(
                    existingRecord, 
                    incomingRecord.observations ?? {},
                    siteConfig
                );
                if (hasChanged) {
                    records.set(siteId, updatedRecord);
                }
            } else {
                records.set(siteId, incomingRecord);
            }
        }
    }

    public async ingestBatch(items: IngestionItem[]): Promise<SiteRecord[]> {
        const records = new Map<SiteId, SiteRecord>();
        const sortedItems = [...items].sort(
            (a, b) => (parseTimestampFromFilename(a.filename) ?? 0) - (parseTimestampFromFilename(b.filename) ?? 0)
        );

        let remainingItems = sortedItems;
        for (const ingestionStage of this.ingestionStages) {
            const unhandledItems: IngestionItem[] = [];
            for (const item of remainingItems) {
                const parsedData = ingestionStage.tryParse(item);
                if (parsedData) {
                    const ingestedSiteRecords = ingestionStage.parseAndGroupObservations(parsedData);
                    await this.consolidateSiteRecords(ingestedSiteRecords, records);
                } else {
                    unhandledItems.push(item);
                }
            }
            remainingItems = unhandledItems;
        }

        for (const record of records.values()) {
            record.analysis = this.analyser.analyse(record);
        }

        return [...records.values()];
    }
}
