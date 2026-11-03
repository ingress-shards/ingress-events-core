import type { Alignment } from "../common/Alignment.js";
import type { PortalId } from "../common/Identifiers.js";

/**
 * Individual shard data.
 */
export interface Shard {
    history: ShardHistoryEntry[];
}

/**
 * Detailed faction alignment mismatch information for a shard link move.
 */
export interface ShardMismatch {
    /** Origin portal capturer alignment at the time of movement */
    originAlign?: Alignment;
    /** Destination portal capturer alignment at the time of movement */
    destAlign?: Alignment;
}

/**
 * Shard movement history entry (Analysed).
 */
export interface ShardHistoryEntry {
    action: ShardAction;
    /** Epoch time in milliseconds */
    moveTime: number;
    /** Internal Portal ID where the action occurred */
    portalId: PortalId;
    /** Internal Destination portal ID (only for "link" or "jump" actions) */
    dest?: PortalId;
    /** Alignment that controlled the action (if applicable) */
    align?: Alignment;
    /** Epoch time in milliseconds when the link was created */
    linkTime?: number;
    /** Detailed mismatch information if faction alignment conflict exists */
    mismatch?: ShardMismatch;
}

/**
 * Unified shard action type covering all possible shard state changes.
 */
export type ShardAction = "spawn" | "link" | "jump" | "no move" | "despawn";

/**
 * Shard path between two portals.
 */
export interface ShardPath {
    /** Distance between portals in meters */
    distance: number;
    /** All links created between these two portals */
    links: Link[];
    /** Random idle teleports across this path (only present if a jump action occurred) */
    teleports?: ShardMove[];
}

/**
 * Link information (Analysed).
 */
export interface Link {
    /** Epoch time in milliseconds when link was created */
    linkTime: number;
    /** Alignment that created the link */
    align: Alignment;
    /** Shard movements that occurred on this link */
    moves: ShardMove[];
}

/**
 * Shard movement along a link (Analysed).
 */
export interface ShardMove {
    origin: PortalId;
    dest: PortalId;
    shardId: number;
    /** Epoch time in milliseconds */
    moveTime: number;
    /** The IDs of any scoring rules this move successfully matched and scored points for */
    scoredRules?: string[];
    /** Total points scored by this move across all matched rules */
    totalPoints?: number;
    /** Whether there is an alignment mismatch for this move */
    mismatch?: boolean;
}
