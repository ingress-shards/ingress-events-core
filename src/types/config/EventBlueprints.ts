import type { PortalHistoryType } from "../../sites/Portal.js";
import type { SeasonEvent } from "../../seasons/Season.js";
import type { ShardAction } from "../../sites/Shard.js";

/**
 * Base definition for a wave window with start and end offsets.
 */
export interface WaveMechanics {
    /** Offset in minutes from event start when wave begins */
    startOffset: number;
    /** Offset in minutes from event start when wave ends */
    endOffset: number;
}

/**
 * Details for how an event type (e.g., ANOMALY) is branded in the UI.
 */
export interface EventMetadata {
    /** Human-readable label for the event type */
    label: string;
}

/**
 * Metadata for custom map ornaments.
 */
export interface Ornament {
    /** Human-readable label for the ornament */
    label: string;
    /** Logic tags to categorize the ornament (e.g. ["pre-event"]) */
    tags: PortalHistoryType[];
    /** Visual styling for the ornament */
    style: {
        /** Hex color for vector markers */
        color?: string;
        /** Path to custom icon image */
        icon?: string;
        /** Size of the custom icon { width, height } */
        size?: { width: number; height: number };
    };
}

/**
 * Wave definition for shard mechanics.
 */
export interface ShardWaveMechanics extends WaveMechanics {
    /** Optional quantity of shards for this specific wave */
    quantity?: number;
}

/**
 * Full definition for shard behavior (spawns, jumps, etc).
 */
export interface ShardMechanics {
    /** List of wave windows */
    waves: ShardWaveMechanics[];
    /** List of scheduled actions within those waves */
    waveActions: {
        /** Type of movement or event */
        action: ShardAction;
        /** Offset in minutes from the wave start */
        time: number;
    }[];
}

/**
 * Supported actions for target portals.
 */
export type TargetActionType = "spawn" | "despawn";

/**
 * Wave definition for scoring target mechanics.
 */
export interface TargetWaveMechanics extends WaveMechanics {
    /** Quantities of targets keyed by faction */
    factionQuantity: { RES?: number; ENL?: number };
}

/**
 * Full definition for target scoring portal behavior.
 */
export interface TargetMechanics {
    /** List of target wave windows */
    waves: TargetWaveMechanics[];
    /** List of scheduled actions for targets */
    waveActions: {
        /** Type of movement or event */
        action: TargetActionType;
        /** Offset in minutes from the wave start */
        time: number;
    }[];
}

/**
 * Root structure for event_blueprints.json
 * @strict
 */
export interface EventBlueprints {
    /** Display branding for each event type */
    events: Record<SeasonEvent, EventMetadata>;
    /** Metadata for ornaments indexed by their ID (e.g., "ap1") */
    ornaments: Record<string, Ornament>;
    /** Shard behavior patterns indexed by ID */
    shardMechanics: Record<string, ShardMechanics>;
    /** Target behavior patterns indexed by ID */
    targetMechanics: Record<string, TargetMechanics>;
    /**
     * Scoring rules grouped by entity type
     */
    scoringRules: {
        shards: Record<string, ShardScoringRule>;
    };
}

/**
 * @strict
 */
export interface ShardScoringRule {
    label: string;
    tooltip: string;
    points: number;
    conditions?: {
        minDistance?: number;
        maxDistance?: number;
        ornaments?: string[];
        isTarget?: boolean;
    };
    maxScoringShardsPerPortal?: number;
    teamAttribution?: "TARGET_OWNER" | "LINK_OWNER";
    allowFurtherPoints?: boolean;
    /** Category under which points are bucketed */
    scoreType: "jumps" | "goals";
}
