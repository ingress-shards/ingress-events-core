import type { ConfigRegistry } from "../config/ConfigRegistry.js";
import type { SiteState } from "../sites/Site.js";
import type { SiteId } from "../common/Identifiers.js";
import type {
    DataObservationAdapter,
    IngestionItem,
} from "./adapters/DataObservationAdapter.js";
import { SiteStateMerger } from "./merging/SiteStateMerger.js";
import type { SiteConfig } from "../config/SiteConfig.js";
import {
    MapSnapshotAdapter,
    ShardJumpCaptureAdapter,
    SiteDiscoveryAdapter,
    SiteTargetPortalsAdapter,
} from "./adapters/index.js";
import { parseTimestampFromFilename } from "../common/Date.js";
import { SiteStateAnalyser } from "./analysis/SiteStateAnalyser.js";

export type { IngestionItem, IngestionPayload } from "./adapters/DataObservationAdapter.js";

export class DataIngestionPipeline {
    private readonly ingestionStages: DataObservationAdapter<any>[];
    private readonly sitesById: Map<SiteId, SiteConfig>;
    private readonly analyser: SiteStateAnalyser;

    constructor(
        private readonly registry: ConfigRegistry,
        candidateSites: SiteConfig[],
        private readonly resolveExistingState?: (siteId: SiteId) => Promise<SiteState | undefined>,
        private readonly merger: SiteStateMerger = new SiteStateMerger()
    ) {
        this.sitesById = new Map(candidateSites.map((s) => [s.geocode.id, s]));
        this.analyser = new SiteStateAnalyser(this.registry);
        this.ingestionStages = [
            new SiteDiscoveryAdapter(candidateSites),
            new MapSnapshotAdapter(this.registry.blueprints.ornaments, candidateSites),
            new SiteTargetPortalsAdapter(candidateSites),
            new ShardJumpCaptureAdapter(candidateSites),
        ];
    }

    private async consolidateSiteStates(
        ingestedSiteStates: SiteState[],
        states: Map<SiteId, SiteState>
    ): Promise<void> {
        for (const incomingState of ingestedSiteStates) {
            const siteId = incomingState.metadata.siteId;
            const existingState = states.get(siteId) ?? await this.resolveExistingState?.(siteId);
            if (existingState) {
                const siteConfig = this.sitesById.get(siteId);
                const { state: updatedState, hasChanged } = this.merger.merge(
                    existingState, 
                    incomingState.telemetry ?? {},
                    siteConfig
                );
                if (hasChanged) {
                    states.set(siteId, updatedState);
                }
            } else {
                states.set(siteId, incomingState);
            }
        }
    }

    public async ingestBatch(items: IngestionItem[]): Promise<SiteState[]> {
        const states = new Map<SiteId, SiteState>();
        const sortedItems = [...items].sort(
            (a, b) => (parseTimestampFromFilename(a.filename) ?? 0) - (parseTimestampFromFilename(b.filename) ?? 0)
        );

        let remainingItems = sortedItems;
        for (const ingestionStage of this.ingestionStages) {
            const unhandledItems: IngestionItem[] = [];
            for (const item of remainingItems) {
                const parsedData = ingestionStage.tryParse(item);
                if (parsedData) {
                    const ingestedSiteStates = ingestionStage.parseAndGroupTelemetry(parsedData);
                    await this.consolidateSiteStates(ingestedSiteStates, states);
                } else {
                    unhandledItems.push(item);
                }
            }
            remainingItems = unhandledItems;
        }

        for (const state of states.values()) {
            state.analysis = this.analyser.analyse(state);
        }

        return [...states.values()];
    }
}
