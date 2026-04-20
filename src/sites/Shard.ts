import type { FactionId } from "../common/Factions.js";
import type { PortalId } from "../common/Identifiers.js";

/**
 * Individual shard data.
 */
export interface Shard {
    shardNumber: number;
    history: ShardHistoryEntry[];
}

/**
 * Shard movement history entry (Analyzed).
 */
export interface ShardHistoryEntry {
    action: ShardAction;
    /** Epoch time in milliseconds */
    moveTime: number;
    /** Internal Portal ID where the action occurred */
    portalId: PortalId;
    /** Internal Destination portal ID (only for "link" or "jump" actions) */
    dest?: PortalId;
    /** Team that controlled the action (if applicable) */
    team?: FactionId;
}

/**
 * Unified shard action type covering all possible shard state changes.
 */
export type ShardAction = "spawn" | "link" | "jump" | "no move" | "despawn";

/**
 * Capture of a single shard jump event (Simplified for storage).
 */
export interface ShardJumpObservation {
    portalGuid: string;
    /** Epoch time in milliseconds */
    timestamp: number;
    action: string;
    destGuid?: string;
}

/**
 * Collection of jump history for all shards.
 * Key: Shard ID
 * Value: Array of jump events
 */
export type ShardJumpHistory = Record<string, ShardJumpObservation[]>;

/**
 * Shard path between two portals.
 */
export interface ShardPath {
    /** All links created between these two portals */
    links: Link[];
    /** Distance between portals in meters */
    distance: number;
}

/**
 * Link information (Analyzed).
 */
export interface Link {
    /** Epoch time in milliseconds when link was created */
    linkTime: number;
    /** Team that created the link */
    team: FactionId;
    /** Shard movements that occurred on this link */
    moves: ShardMove[];
}

/**
 * Shard movement along a link (Analyzed).
 */
export interface ShardMove {
    origin: PortalId;
    dest: PortalId;
    shardId: number;
    /** Epoch time in milliseconds */
    moveTime: number;
    /** Points awarded */
    points: number;
}
