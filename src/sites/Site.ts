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
    /** Complete state of everything at the site for the entire event */
    siteState: SiteState;
    /** Periodic snapshots of shard movements (Waves), keyed by wave number */
    waves: Record<number, SiteState>;
    /** Official site result/points contributing to season standings */
    seasonPoints: Points;
    /** Whether the site has target data */
    hasTargetData: boolean;
}

export interface SiteState {
    /** Key format: "portalId-portalId" */
    shardPaths: Record<string, ShardPath>;
    /** Detailed points snapshot */
    points: PointsSnapshot;
    counters: Counters;
}

/**
 * Detailed breakdown of points scored within a specific category.
 */
export interface PointsBreakdown {
    /** Sub-total points for this category */
    summary: Points;
    /** Breakdown of points scored by each rule key in this category */
    detail: Record<string, Points>;
}

/**
 * Detailed snapshot of points scored at a site or wave.
 */
export interface PointsSnapshot {
    /** Faction-wide accumulated total points across all categories */
    total: Points;
    /** Breakdown of jump-based points */
    jumps: PointsBreakdown;
    /** Breakdown of goal/target landing points */
    goals: PointsBreakdown;
}

/**
 * Raw point tallies or rule-based results mapped by FactionId.
 */
export type Points = Partial<Record<FactionId, number>>;

export interface Counters {
    shards: {
        moving: number;
        nonMoving: number;
    };
    links: number;
    paths: number;
    linkAlignmentMismatch?: number;
}
