import type { FactionId } from "./Factions.js";
import type { Coordinates } from "./Geo.js";

// ============================================================================
// SECTION 1: COMMON TYPES
// ============================================================================

/**
 * Unique identifier for an anomaly/event series (e.g., '2025-plusalpha').
 */
export type SeriesId = string;

/**
 * Supported Ingress event types for shard activities.
 */
export type EventType = "ANOMALY" | "SKIRMISH" | "SINGULAR" | "STORM" | "SINGLE_SHARD" | "MULTIPLE_SHARDS" | "UNKNOWN";

/**
 * Specific actions occurred or scheduled within a wave.
 */
export interface WaveAction {
    /** Type of movement or event */
    type: "spawn" | "jump" | "despawn";
    /** Offset in minutes from the wave start */
    time: number;
}

/**
 * Base properties for any time-windowed wave.
 */
export interface BaseWaveDetails {
    /** Start time in HH:mm format */
    startTime: string;
    /** End time in HH:mm format */
    endTime: string;
}

/**
 * Geolocation with a descriptive name.
 */
export interface EventLocation extends Coordinates {
    /** Human readable location name */
    location: string;
}

// ============================================================================
// SECTION 2: SERIES METADATA (Rules & Schedules)
// ============================================================================

/**
 * Details for a specific wave of shards.
 */
export interface ShardWaveDetails extends BaseWaveDetails {
    /** The quantity of shards to be spawned globally for this wave */
    quantity: number;
}

/**
 * Details for a specific wave of target portals.
 * Quantities are grouped by faction to handle asymmetric or neutral spawns.
 */
export interface TargetWaveDetails extends BaseWaveDetails {
    /** Quantities of target portals to be spawned, keyed by faction identifier */
    factionQuantity: Partial<Record<FactionId, number>>;
}

/**
 * Full schedule for shard or target behavior.
 */
export interface WaveSchedule<T extends BaseWaveDetails> {
    /** List of time-windowed wave definitions */
    waves: T[];
    /** List of dynamic actions occurring within the waves */
    waveActions: WaveAction[];
}

/**
 * A specific occurrence of an event type, listing its locations.
 * These are usually date-specific occurrences that supplement or define the series.
 */
export interface SpecialEvent {
    /** ISO date string (YYYY-MM-DD) */
    date: string;
    /** List of active locations on this day */
    locations: EventLocation[];
}

/**
 * Full configuration for a specific type of event within a series.
 * This defines the "Spawning Manifest" for the event.
 */
export interface EventTypeDetails {
    /** Standard local start time for this event type (e.g. "14:00") */
    startTime: string;
    /** Length of the measurement/action window in minutes */
    actionWindowMinutes: number;
    /** Shard spawning schedule and wave definitions */
    shards: WaveSchedule<ShardWaveDetails>;
    /** Portal Target spawning schedule (where shards can eventually be scored) */
    targets?: WaveSchedule<TargetWaveDetails>;
    /** Optional events with specific dates and locations. These are in addition to the events specified on the series overview map. */
    events?: SpecialEvent[];
}

/**
 * Metadata for an entire Anomaly series.
 */
export interface SeriesMetadata {
    /** Unique series ID (e.g. '2025-plusalpha') */
    id: SeriesId;
    /** Display name of the series */
    name: string;
    /** Year the series takes place */
    year: number;
    /** URL to the official announcement or rules */
    overviewUrl: string;
    /** Spawning schedules and metadata mapped by event type */
    eventTypes: Partial<Record<EventType, EventTypeDetails>>;
    /** If true, this series is shown by default in the UI */
    defaultView?: boolean;
}

/**
 * Root structure for series_metadata.json
 */
export interface SeriesMetadataConfig {
    /** List of all defined series */
    series: SeriesMetadata[];
    /** Optional build/deploy version */
    version?: string;
}

// ============================================================================
// SECTION 3: SERIES GEOCODE (Location Data)
// ============================================================================

/**
 * Specific geocoded site information for a series.
 */
export interface SeriesGeocodeSite extends EventLocation {
    /** Unique site ID (usually {series-id}-{location-id}) */
    id: string;
    /** ISO 8601 date string with timezone identifier (e.g., "2024-08-17T14:00:00[Asia/Singapore]") */
    date: string;
    /** Categorization of the event at this specific site */
    type: EventType;
    /** IANA Timezone name (e.g. "Europe/London") - used for date formatting */
    timezone: string;
    /** ISO 3166-1 alpha-2 country code */
    country_code: string;
}

/**
 * Root structure for series_geocode.json
 */
export type SeriesGeocodeConfig = {
    /** Optional build/deploy version */
    version?: string;
} & Record<
    SeriesId,
    {
        /** Sites indexed by series ID */
        sites: SeriesGeocodeSite[];
    }
>;

// ============================================================================
// SECTION 4: VERSIONING
// ============================================================================

/**
 * Root structure for version.json
 */
export interface VersionConfig {
    /** semantic-release version or git hash */
    version: string;
}
