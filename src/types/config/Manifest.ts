import type { SeasonId } from "../../common/Identifiers.js";
import type { SeasonEvent } from "../../seasons/Season.js";
import type { SiteLocation } from "../../common/Geo.js";

/**
 * Site specific metadata within a scheduled season component.
 * @strict
 */
export interface SiteManifestMetadata extends SiteLocation {
    /** Optional site-specific shard count overrides per wave */
    shardCounts?: number[];
}

/**
 * Component of an Anomaly season, defining specific shard/target behavior.
 * @strict
 */
export interface SeasonComponent {
    eventType: SeasonEvent;
    /** Default local start time (HH:mm) */
    startTime: string;
    /** Event mechanics configuration, including shards and their scoring rules */
    mechanics: {
        shards?: {
            shardMechanics: string;
            targetMechanics?: string;
            scoring: {
                rules: string[];
                wavePointAggregation?: number[][];
                seasonPoints?: number;
            };
        };
    };
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
 * @strict
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
 * @strict
 */
export interface SeasonManifest {
    seasons: SeasonMetadata[];
}
