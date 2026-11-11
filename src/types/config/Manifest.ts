import type { SeasonId } from "../../common/Identifiers.js";
import type { SiteLocation } from "../../common/Geo.js";

/**
 * Supported Ingress event types.
 */
export type EventType =
    | "ANOMALY"
    | "SKIRMISH"
    | "INVESTIGATION"
    | "SINGULAR"
    | "STORM"
    | "SINGLE_SHARD"
    | "MULTIPLE_SHARDS"
    | "UNKNOWN";

/**
 * Host site specification within a scheduled season event.
 * @strict
 */
export interface HostSite extends SiteLocation {
    /** Optional site-specific shard count overrides per wave */
    shardCounts?: number[];
}

/**
 * Event format within an Anomaly season, defining mechanics, schedule, and scoring rules.
 * @strict
 */
export interface SeasonEvent {
    eventType: EventType;
    /** Default local start time (HH:mm) */
    startTime: string;
    /** Event mechanics configuration, including shards and their scoring rules */
    mechanics: {
        shards?: {
            shardMechanics: string;
            targetMechanics?: string;
            /** Number of consecutive jump windows to group together in presentation views (default 1) */
            jumpGroupSize?: number;
            scoring: {
                linkRules?: string[];
                goalRules?: string[];
                wavePointAggregation?: number[][];
                seasonPoints?: number;
            };
        };
    };
    /** Optional specific dates and locations for this event */
    schedule?: {
        /** ISO date (YYYY-MM-DD) */
        date: string;
        /** List of active host sites on this day */
        sites: HostSite[];
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
    events: SeasonEvent[];
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
