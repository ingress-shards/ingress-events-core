import type { SeasonId } from "../common/Identifiers.js";
import type { SeasonEvent } from "../seasons/Season.js";
import type { NamedLocation } from "../common/Geo.js";

/**
 * Site specific metadata within a scheduled season component.
 */
export interface SiteManifestMetadata extends NamedLocation {
    /** Optional site-specific shard count overrides per wave */
    shardCounts?: number[];
}

/**
 * Component of an Anomaly season, defining specific shard/target behavior.
 */
export interface SeasonComponent {
    eventType: SeasonEvent;
    /** Default local start time (HH:mm) */
    startTime: string;
    /** ID of the matching shard mechanics in blueprints */
    shardMechanics?: string;
    /** ID of the matching target mechanics in blueprints */
    targetMechanics?: string;
    /** Optional specific dates and locations for this component */
    schedule?: {
        /** ISO date (YYYY-MM-DD) */
        date: string;
        /** List of active sites on this day */
        sites: SiteManifestMetadata[];
    }[];
}

/**
 * Metadata for an entire Anomaly season.
 */
export interface SeasonMetadata {
    id: SeasonId;
    /** Display name of the season */
    name: string;
    year: number;
    overviewUrl: string;
    components: SeasonComponent[];
    /** If true, this season is shown by default in the UI */
    defaultView?: boolean;
}

/**
 * Root structure for season_manifest.json
 */
export interface SeasonManifest {
    seasons: SeasonMetadata[];
}
