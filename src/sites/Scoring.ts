import type { FactionId } from "../common/Alignment.js";
import type { PortalId } from "../common/Identifiers.js";

/**
 * Points tally mapped by faction. Non-scoring factions are omitted.
 */
export type FactionPoints = Partial<Record<FactionId, number>>;

/**
 * Category rollup of flat points (used on both WaveState and ShardJumpWindow).
 */
export interface PointsSummary {
    total?: FactionPoints;
    links?: FactionPoints;
    goals?: FactionPoints;
}

/**
 * Detailed target portal scoring actions.
 */
export interface TargetGoalDetail {
    portalId: PortalId;
    scoredCount?: number;
    unscoredCount?: number;
}

/**
 * Official site points contributed toward season standings (proportional / ratio-based events).
 * Omitted if the event only uses raw in-game points.
 */
export interface SeasonPointsResult {
    /** Allocated season points (e.g. { RES: 82.1, ENL: 17.9 }) */
    points: FactionPoints;
    /** The wave numbers that directly contributed to this final points score, keyed by faction */
    contributingWaves?: Partial<Record<FactionId, number[]>>;
}

