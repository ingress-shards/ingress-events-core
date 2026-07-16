import type { SeasonMetadata, SiteGeocode, ShardMechanics, TargetMechanics } from "../types/index.js";
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
    /** Shard mechanics used at this site */
    shardMechanics?: ShardMechanics;
    /** Target mechanics used at this site */
    targetMechanics?: TargetMechanics;
    /** Calculated schedules and timings */
    actionSchedule: ActionSchedule;
}

export interface ActionSchedule {
    /** Event start time in epoch milliseconds */
    start: number;
    /** Cutoff time for pre-event ornaments (2 hours before start) in epoch milliseconds */
    preEventCutoff: number;
    /** Event end time (end of the final wave) in epoch milliseconds */
    end: number;
    /** Ordered timeline of waves and their scheduled movements */
    waves: WaveSchedule[];
}

export interface WaveSchedule {
    /** 1-indexed wave number (e.g. 1, 2, 3) */
    waveNumber: number;
    /** Start of the wave window in epoch milliseconds */
    start: number;
    /** End of the wave window in epoch milliseconds */
    end: number;
    /** Fully resolved absolute timestamps for actions (spawns, jumps) in this wave */
    shardsActions?: ShardActionSchedule[];
}

export interface ShardActionSchedule {
    /** The type of movement or event (e.g. "spawn", "jump", "link") */
    action: ShardAction;
    /** Absolute time when the action occurs in epoch milliseconds */
    time: number;
}
