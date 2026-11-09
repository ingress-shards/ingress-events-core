/**
 * Base operational telemetry metrics common to any scope (a single wave or a whole site).
 */
export interface TelemetryStatistics {
    shards: {
        moving: number;
        nonMoving: number;
    };
    links: number;
    paths: number;
    /** The number of target portals active in this context (optional, omitted if 0) */
    targets?: number;
}

/**
 * Operational telemetry statistics for an individual wave.
 * Strictly contains physical activity metrics; zero diagnostic anomaly rollups.
 */
export type WaveStatistics = TelemetryStatistics;

/**
 * Canonical site-wide operational statistics and diagnostic anomaly rollups.
 */
export interface SiteStatistics extends TelemetryStatistics {
    /** Number of shard movements that experienced faction/portal alignment mismatches */
    mismatchedMoves?: number;
    /** Number of shard jump windows with an observed duration greater than 1 minute (> 60s) */
    extendedJumpWindows?: number;
    /** Number of shard actions executed from an invalid/discontinuous origin portal */
    invalidActions?: number;
}
