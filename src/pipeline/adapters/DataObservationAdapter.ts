import type { SiteState } from "../../sites/Site.js";
import type { Capture } from "../../types/observations/Capture.js";

export type IngestionPayload = string | Capture;

export interface IngestionItem {
    filename: string;
    data: IngestionPayload;
}

export interface DataObservationAdapter<T> {
    tryParse(item: IngestionItem): T | undefined;
    /**
     * Parses the incoming data format T, groups telemetry geospatially
     * around the active site centroids, and returns a list of site-specific SiteState objects.
     */
    parseAndGroupTelemetry(input: T): SiteState[];
}
