import type { SiteGeocode } from "../types/index.js";
import type { SeasonId } from "../common/Identifiers.js";
import type { ShardAction } from "../sites/Shard.js";

/**
 * Site specific configuration.
 */
export interface SiteConfig {
    /** Parent season identity */
    seasonId: SeasonId;
    /** Site identity and geocode */
    geocode: SiteGeocode;
    /** Calculated schedules and timings */
    timeline: SiteTimeline;
}

export interface SiteTimeline {
    /** Event start time in epoch milliseconds */
    start: number;
    /** Cutoff time for pre-event ornaments (2 hours before start) in epoch milliseconds */
    preEventCutoff: number;
    /** Event end time (end of the final wave) in epoch milliseconds */
    end: number;
    /** Total duration of the event in minutes */
    durationMinutes: number;
    /** Number of consecutive jump windows to group together in presentation views */
    jumpGroupSize?: number;
    /** Ordered timeline of shard waves and their scheduled movements */
    shards: WaveTimeline[];
    /** Ordered timeline of target waves and their active windows */
    targets?: WaveTimeline[];
}

/** @deprecated Use SiteTimeline */
export type EventTimeline = SiteTimeline;

export interface WaveTimeline {
    /** 1-indexed wave number (e.g. 1, 2, 3) */
    waveNumber: number;
    /** Start of the wave window in epoch milliseconds */
    start: number;
    /** End of the wave window in epoch milliseconds */
    end: number;
    /** Expected number of shards for this wave (from site override or shard wave quantity) */
    expectedShards?: number;
    /** Fully resolved absolute timestamps for actions (spawns, jumps) in this wave */
    shardsActions?: ScheduledShardAction[];
}

export interface ScheduledShardAction {
    /** The type of movement or event (e.g. "spawn", "jump", "link") */
    action: ShardAction;
    /** Absolute time when the action occurs in epoch milliseconds */
    time: number;
}

