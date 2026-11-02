import type { SiteRecord } from "../../sites/Site.js";
import type { Capture } from "../capture/Capture.js";

export type IngestionPayload = string | Capture;

export interface IngestionItem {
    filename: string;
    data: IngestionPayload;
}

export interface DataObservationAdapter<T> {
    tryParse(item: IngestionItem): T | undefined;
    /**
     * Parses the incoming data format T, groups observations geospatially
     * around the active site centroids, and returns a list of site-specific SiteRecord objects.
     */
    parseAndGroupObservations(input: T): SiteRecord[];
}
