import type { Alignment, FactionId } from "../common/Alignment.js";
import type { Shard, ShardPath } from "./Shard.js";
import type { PortalId, ShardId, SiteId, SeasonId } from "../common/Identifiers.js";
import type { ObservedPortal } from "./Portal.js";
import type { Coordinates } from "../common/Geo.js";
import type { PointsSummary, SeasonPointsResult, TargetGoalDetail } from "./Scoring.js";

export * from "./Scoring.js";

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
 * Unified record of a site.
 * This is the primary storage format for the local IndexedDB.
 */
export interface SiteRecord {
    metadata: SiteRecordMetadata;
    observations?: SiteObservation;
    analysis?: SiteAnalysis;
}

/**
 * Collection of site records keyed by site ID.
 */
export type SiteRecordMap = Record<SiteId, SiteRecord>;

export interface SiteRecordMetadata {
    siteId: SiteId;
    seasonId: SeasonId;
    /** Epoch time in milliseconds */
    lastUpdated: number;
}

export interface SiteObservation {
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
    statistics?: Statistics;
    /** Optional telemetry anomalies or data quality issues detected across the site */
    diagnostics?: Diagnostics;
}

export interface WaveState {
    points: PointsSummary;
    statistics: Statistics;
    shardJumpWindows: ShardJumpWindow[];
    /** Optional telemetry anomalies or data quality issues detected in this wave */
    diagnostics?: Diagnostics;
}

export interface ShardJumpWindow {
    /** Epoch time of this jump window */
    timestamp: number;
    /** Sequential jump number within the wave (1, 2, 3...) */
    jumpNumber: number;
    /** Overall number of raw shard history items in this window */
    historyCount: number;
    /** Points scored in this jump window (total, links, goals by faction) */
    points?: PointsSummary;
    /** Link rule occurrence counts keyed by faction (e.g. { RES: { jump_rule: 2 } }) */
    linksBreakdown?: Partial<Record<FactionId, Record<string, number>>>;
    /** Target portal scoring details keyed by faction */
    goalsBreakdown?: Partial<Record<FactionId, TargetGoalDetail[]>>;
    /** Optional telemetry anomalies or data quality issues detected in this jump window */
    diagnostics?: Diagnostics;
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

/**
 * Quality and anomaly diagnostics detected during event analysis.
 */
export interface Diagnostics {
    /** Number of alignment mismatches between link creator and portal alignments, keyed by alignment */
    linkAlignmentMismatches?: Partial<Record<Alignment, number>>;
}

export interface Statistics {
    shards: {
        moving: number;
        nonMoving: number;
    };
    links: number;
    paths: number;
    /** The number of target portals active in this context (optional, omitted if 0) */
    targets?: number;
}
