import type { SeasonMetadata, SiteGeocode, ShardMechanics, TargetMechanics, ShardScoringRule } from "../types/index.js";
import type { SiteId } from "../common/Identifiers.js";
import type { ShardAction } from "../sites/Shard.js";

/**
 * Unified configuration for an entire anomaly season.
 */
export interface SeasonConfig {
    /** season identity and metadata */
    metadata: SeasonMetadata;
    /** Configuration for each site in the season */
    sites: Record<SiteId, SiteConfig>;
}

/**
 * Site specific configuration (Build-time).
 */
export interface SiteConfig {
    /** Site identity and geocode */
    geocode: SiteGeocode;
    /** Calculated schedules and timings */
    timeline: EventTimeline;
    mechanics: {
        shards?: {
            /** Shard mechanics used at this site */
            shardMechanics: ShardMechanics;
            /** Target mechanics used at this site */
            targetMechanics?: TargetMechanics;
            scoring: {
                /** Scoring rules for shards */
                shardScoringRules: Record<string, ShardScoringRule>;
                /** For each wave, an array of point values for each scoring event within that wave. */
                wavePointAggregation?: number[][];
                /** Optional static season points override */
                seasonPoints?: number;
            }
        }
    }
}

export interface EventTimeline {
    /** Event start time in epoch milliseconds */
    start: number;
    /** Cutoff time for pre-event ornaments (2 hours before start) in epoch milliseconds */
    preEventCutoff: number;
    /** Event end time (end of the final wave) in epoch milliseconds */
    end: number;
    /** Ordered timeline of shard waves and their scheduled movements */
    shards: WaveTimeline[];
    /** Ordered timeline of target waves and their active windows */
    targets?: WaveTimeline[];
}

export interface WaveTimeline {
    /** 1-indexed wave number (e.g. 1, 2, 3) */
    waveNumber: number;
    /** Start of the wave window in epoch milliseconds */
    start: number;
    /** End of the wave window in epoch milliseconds */
    end: number;
    /** Fully resolved absolute timestamps for actions (spawns, jumps) in this wave */
    shardsActions?: ScheduledShardAction[];
}

export interface ScheduledShardAction {
    /** The type of movement or event (e.g. "spawn", "jump", "link") */
    action: ShardAction;
    /** Absolute time when the action occurs in epoch milliseconds */
    time: number;
}
