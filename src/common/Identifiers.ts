/**
 * Fundamental identifier types used across the Ingress Shards projects.
 */

/**
 * Unique identifier for an anomaly/event season.
 * @example "2025-plusalpha"
 */
export type SeasonId = string;

/**
 * Unique identifier for a specific site within a season.
 */
export type SiteId = string;

/**
 * Internal numeric portal identifier used in processed shard data.
 */
export type PortalId = number;

/**
 * Ingress portal GUID (Globally Unique Identifier) from Niantic.
 */
export type PortalGuid = string;

/**
 * Internal numeric identifier for a shard. Note that this is not the same as the shard number.
 */
export type ShardId = number;
