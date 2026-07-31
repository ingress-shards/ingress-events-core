import type { SeasonId, SiteId } from "../../common/Identifiers.js";
import type { SeasonEvent } from "../../seasons/Season.js";
import type { SiteLocation } from "../../common/Geo.js";

/**
 * Site specific geocode data.
 */
export interface SiteGeocode extends SiteLocation {
    /** Unique ID for the site (e.g. '2025-plusalpha-singapore') */
    id: SiteId;
    /** The event type this site belongs to (for blueprint matching) */
    eventType: SeasonEvent;
    /** Full ISO start time with [TimeZone] suffix */
    startTime: string;
    /** IANA time zone identifier (e.g. 'Asia/Singapore') */
    timeZone: string;
    /** ISO 3166-1 alpha-2 country code */
    countryCode: string;
}

/**
 * Geocode record for an entire anomaly season.
 */
export interface SeasonGeocodeEntry {
    /** Unique season ID */
    id: SeasonId;
    /** List of sites with geocode data */
    sites: SiteGeocode[];
}

/**
 * Root structure for season_geocode.json
 */
export interface SeasonGeocode {
    seasons: SeasonGeocodeEntry[];
}
