import type { SeasonMetadata, SiteGeocode, ShardMechanics, TargetMechanics } from "../types/index.js";
import type { SiteId } from "../common/Identifiers.js";

/**
 * Unified configuration for an entire anomaly season.
 */
export interface SeasonConfig {
    /** season identity and metadata */
    metadata: SeasonMetadata;
    /** Configuration for each site in the season */
    sites: Record<SiteId, SiteConfig>;
}

/**
 * Site specific configuration (Build-time).
 */
export interface SiteConfig {
    /** Site identity and geocode */
    geocode: SiteGeocode;
    /** Shard mechanics used at this site */
    shardMechanics?: ShardMechanics;
    /** Target mechanics used at this site */
    targetMechanics?: TargetMechanics;
}
