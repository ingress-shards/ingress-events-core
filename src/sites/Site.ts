import type { FactionId } from "../common/Factions.js";
import type { Shard, ShardPath } from "./Shard.js";
import type { PortalId, ShardId, SiteId, SeasonId } from "../common/Identifiers.js";
import type { ObservedPortal } from "./Portal.js";
import type { Coordinates } from "../common/Geo.js";

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
    [SitePhase.NoData]: "No Shard Data",
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
    seasonPoints?: SeasonPointsResult;
    /** Whether pre-event discovery ornaments were detected on the portals */
    hasPreEventOrnaments: boolean;
    /** Whether the event has target mechanics defined */
    hasTargetMechanics?: boolean;
    /** Periodic snapshots of shard movements (Waves), keyed by wave number */
    waves: Record<number, WaveState>;
    /** Root-level storage of paths to avoid duplication */
    siteShardPaths?: Record<string, ShardPath>;
    /** Site-wide aggregated statistics across all waves (undefined for single-wave events) */
    siteStatistics?: Statistics;
}

export interface WaveState {
    points: PointsSnapshot;
    statistics: Statistics;
    shardActionWindows: ShardActionWindow[];
}

export interface ShardActionWindow {
    /** Epoch time of this action window */
    timestamp: number;
    /** The type of movement or event (e.g. "spawn", "jump", "despawn") */
    actionType?: "spawn" | "jump" | "despawn";
    /** User-friendly display label (e.g. "Spawn", "J1", "J2") */
    actionLabel?: string;
    /** Total points scored specifically in this window */
    points: Points;
    /** Grouped by faction at the top level */
    factionBreakdowns?: Partial<Record<FactionId, FactionPointsBreakdown>>;
    /** Overall number of shard actions (spawns, jumps, despawns, etc.) in this window */
    actionsCount: number;
}

export interface GoalActionDetail {
    portalId: PortalId;
    scoredCount: number;
    unscoredCount: number;
}

export interface SeasonPointsResult {
    /** Points scored for the season (e.g. { RES: 4.5, ENL: 1.5 }) */
    points: Points;
    /** The wave numbers that directly contributed to this final points score, keyed by faction */
    contributingWaves?: Partial<Record<FactionId, number[]>>;
}

export interface FactionPointsBreakdown {
    /** Rule occurrence counts (e.g. "regular" -> 5) */
    links?: Record<string, number>;
    /** Goal portal scoring details */
    goals?: GoalActionDetail[];
    /** Number of alignment mismatches */
    linkAlignmentMismatches?: number;
}

/**
 * Detailed snapshot of points scored at a site or wave.
 */
export interface PointsSnapshot {
    /** Faction-wide accumulated total points across all categories */
    total: Points;
    /** Flat points from links/jumps */
    links: Points;
    /** Flat points from target portal scoring */
    goals?: Points;
}

/**
 * Raw point tallies or rule-based results mapped by FactionId.
 */
export type Points = Partial<Record<FactionId, number>>;

export interface Statistics {
    shards: {
        moving: number;
        nonMoving: number;
    };
    links: number;
    paths: number;
    linkAlignmentMismatch?: number;
    /** The number of target portals active in this context */
    targetsCount: number;
}

