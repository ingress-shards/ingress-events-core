import type { SiteId } from "../../common/Identifiers.js";
import type { SiteGeocode } from "../config/Geocode.js";
import type { SiteObservation } from "../../sites/Site.js";

export interface DataObservationAdapter<T> {
    /**
     * Parses the incoming data format T, groups observations geospatially
     * around the active site centroids, and returns a Map of site-specific observations.
     */
    parseAndGroup(input: T, activeSites: SiteGeocode[]): Map<SiteId, SiteObservation>;
}
