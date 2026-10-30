import type { SiteRecord } from "../../sites/Site.js";

export interface DataObservationAdapter<T> {
    /**
     * Parses the incoming data format T, groups observations geospatially
     * around the active site centroids, and returns a list of site-specific SiteRecord objects.
     */
    parseAndGroupObservations(input: T): SiteRecord[];
}
