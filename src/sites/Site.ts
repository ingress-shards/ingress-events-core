import type { FactionId } from "../common/Alignment.js";
import type { Shard, ShardPath } from "./Shard.js";
import type { PortalId, ShardId, SiteId, SeasonId } from "../common/Identifiers.js";
import type { ObservedPortal } from "./Portal.js";
import type { Coordinates } from "../common/Geo.js";
import type { PointsSummary, SeasonPointsResult, TargetGoalDetail } from "./Scoring.js";
import type { SiteStatistics, WaveStatistics } from "./Statistics.js";

/**
 * Represents the current lifecycle phase of an Ingress site.
 */
export enum SitePhase {
    Scheduled = 0, // In the future, no intel (ornaments) yet
    Discovery = 1, // In the future, intel (ornaments) available
    StandBy = 2, // Site is not yet active, but very soon!
    Active = 3, // Site and event elements (shards / battle beacons) are active 
    Processing = 4, // Event finished, but data is missing or incomplete
    Complete = 5, // Event finished and all expected data is available
    NoData = 6, // No data available (can be used for error states too)
}

export const PhaseDisplayNames: Record<SitePhase, string> = {
    [SitePhase.Scheduled]: "Scheduled",
    [SitePhase.Discovery]: "Discovery",
    [SitePhase.StandBy]: "Stand By",
    [SitePhase.Active]: "Active",
    [SitePhase.Processing]: "Processing",
    [SitePhase.Complete]: "Complete",
    [SitePhase.NoData]: "No Data",
};

/**
 * Unified state of a site.
 * This is the primary storage format for the local IndexedDB.
 */
export interface SiteState {
    metadata: SiteStateMetadata;
    telemetry?: SiteTelemetry;
    analysis?: SiteAnalysis;
}

/**
 * Collection of site states keyed by site ID.
 */
export type SiteStateMap = Record<SiteId, SiteState>;

export interface SiteStateMetadata {
    siteId: SiteId;
    seasonId: SeasonId;
    /** Epoch time in milliseconds */
    lastUpdated: number;
}

export interface SiteTelemetry {
    portals?: Record<PortalId, ObservedPortal>;
    shards?: Record<ShardId, Shard>;
}

export interface SiteAnalysis {
    /** Geographic center point of all portals */
    centroid?: Coordinates;
    /** Official site result/points contributing to season standings and their contributing waves */
    seasonPointsResult?: SeasonPointsResult;
    /** Periodic snapshots of shard movements (Waves), keyed by wave number */
    waves: Record<number, WaveState>;
    /** Root-level storage of paths to avoid duplication */
    shardPaths?: Record<string, ShardPath>;
    /** Site-wide aggregated statistics across all waves (undefined for single-wave events) */
    statistics?: SiteStatistics;
}

export interface WaveState {
    points: PointsSummary;
    shardJumpWindows: ShardJumpWindow[];
    /** Operational telemetry metrics for this wave (optional) */
    statistics?: WaveStatistics;
}

export interface ShardJumpWindow {

    /** Epoch time of scheduled jump window start (ms) */
    scheduledStart: number;
    /** Epoch time of the latest shard movement observed in this window (ms) */
    actualEnd: number;
    /** Sequential jump number within the wave (1, 2, 3...) */
    jumpNumber: number;
    /** Total number of shard movements or actions observed in this window */
    actionCount: number;
    /** Points scored in this jump window (total, links, goals by faction) */
    points?: PointsSummary;
    /** Link rule occurrence counts keyed by faction (e.g. { RES: { jump_rule: 2 } }) */
    linksBreakdown?: Partial<Record<FactionId, Record<string, number>>>;
    /** Target portal scoring details keyed by faction */
    goalsBreakdown?: Partial<Record<FactionId, TargetGoalDetail[]>>;
    /** Faction-attributed count of scored shard jumps that experienced portal alignment mismatches */
    mismatchedScoringJumps?: Partial<Record<FactionId, number>>;
}

/**
 * A logical collection of discrete ShardJumpWindows for presentation grouping.
 * All metrics (timestamps, points, desyncs) are derived from the constituent windows.
 */
export interface ShardJumpGroup {
    groupIndex: number;
    label: string;
    windows: ShardJumpWindow[];
}

