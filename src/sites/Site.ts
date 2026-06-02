import type { FactionId } from "../common/Factions.js";
import type { Shard, ShardPath } from "./Shard.js";
import type { PortalId, ShardId } from "../common/Identifiers.js";
import type { SiteGeocode } from "../contracts/Geocode.js";
import type { Portal } from "./Portal.js";
import type { Coordinates } from "../common/Geo.js";

/**
 * Represents the current lifecycle phase of an Ingress site.
 */
export enum SitePhase {
    Scheduled = 0, // In the future, no intel (ornaments) yet
    Discovery = 1, // In the future, intel (ornaments) available
    Active = 2, // Event is currently happening
    Processing = 3, // Event finished, but data is missing or incomplete
    Complete = 4, // Event finished and all expected shard data is available
    NoData = 5, // Event finished > 24h ago with zero shard data recovered
}

export const PhaseDisplayNames: Record<SitePhase, string> = {
    [SitePhase.Scheduled]: "Scheduled",
    [SitePhase.Discovery]: "Discovery",
    [SitePhase.Active]: "Active",
    [SitePhase.Processing]: "Processing",
    [SitePhase.Complete]: "Complete",
    [SitePhase.NoData]: "No Shard Data Available",
};

/**
 * Unified record of a site.
 * This is the primary storage format for the local IndexedDB.
 */
export interface SiteRecord {
    /** Epoch time in milliseconds */
    lastUpdated: number;
    metadata: SiteRecordMetadata;
    observations?: SiteObservation;
    analysis?: SiteAnalysis;
}

export interface SiteRecordMetadata {
    /** Site geocode information */
    geocode: SiteGeocode;
    schedule: any;
}

export interface SiteObservation {
    portals: Record<PortalId, Portal>;
    shards: Record<ShardId, Shard>;
}

export interface SiteAnalysis {
    /** Geographic center point of all portals */
    centroid: Coordinates;
    /** Complete state of everything at the site for the entire event */
    siteState: SiteState;
    /** Periodic snapshots of shard movements (Waves) */
    waves: SiteState[];
    /** Official site result/points contributing to season standings */
    siteScore: Points;
    /** Whether the site has target data */
    hasTargetData: boolean;
}

/**
 * Comprehensive state of a site at a specific snapshot (Wave) or for the whole event.
 */
export interface SiteState {
    /** Key format: "portalId-portalId" */
    shardPaths: Record<string, ShardPath>;
    /** Raw point tallies */
    points: Points;
    counters: Counters;
    /** Active time period for this state snapshot (epoch milliseconds) */
    period?: {
        start: number;
        end: number;
    };
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
}
