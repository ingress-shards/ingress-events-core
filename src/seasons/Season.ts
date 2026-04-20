import type { SeasonId, SiteId } from "../common/Identifiers.js";
import type { SiteRecord } from "../sites/Site.js";

/**
 * Supported Ingress event types.
 */
export type SeasonEvent =
    | "ANOMALY"
    | "SKIRMISH"
    | "INVESTIGATION"
    | "SINGULAR"
    | "STORM"
    | "SINGLE_SHARD"
    | "MULTIPLE_SHARDS"
    | "UNKNOWN";

/**
 * Season-level data
 */
export interface SeasonRecord {
    seasonId: SeasonId;
    /** Collection of individual site data */
    sites: Record<SiteId, SiteRecord>;
}
