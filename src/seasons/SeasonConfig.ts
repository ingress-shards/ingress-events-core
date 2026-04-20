import type { SeasonMetadata } from "../contracts/Manifest.js";
import type { SiteId } from "../common/Identifiers.js";
import type { SiteGeocode } from "../contracts/Geocode.js";
import type { ShardMechanics, TargetMechanics } from "../contracts/EventBlueprints.js";

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
