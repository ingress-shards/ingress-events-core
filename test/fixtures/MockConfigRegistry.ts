import { EventConfigRegistry } from "../../src/config/EventConfigRegistry.js";
import type { EventBlueprints, EventMetadata, EventType, SeasonGeocode, SeasonManifest, SiteGeocode } from "../../src/types/index.js";

export interface MockRegistryOptions {
    siteId?: string;
    seasonId?: string;
    latE6?: number;
    lngE6?: number;
    startTime?: string;
    blueprints?: Partial<EventBlueprints>;
    extraSites?: SiteGeocode[];
}

const defaultEvents: Record<EventType, EventMetadata> = {
    ANOMALY: { label: "Anomaly" },
    SKIRMISH: { label: "Shard Skirmish" },
    INVESTIGATION: { label: "Shard Investigation" },
    SINGULAR: { label: "Shard Singular" },
    STORM: { label: "Shard Storm" },
    SINGLE_SHARD: { label: "Single Shard" },
    MULTIPLE_SHARDS: { label: "Multiple Shards" },
    UNKNOWN: { label: "Unknown" }
};

export const createMockEventConfigRegistry = (options: MockRegistryOptions = {}): EventConfigRegistry => {
    const siteId = options.siteId ?? "test-site";
    const seasonId = options.seasonId ?? "test-season";
    const latE6 = options.latE6 ?? 10000000;
    const lngE6 = options.lngE6 ?? 20000000;
    const startTime = options.startTime ?? "2026-06-18T12:00:00Z[UTC]";

    const defaultSite: SiteGeocode = {
        id: siteId,
        name: "Test Site",
        latE6,
        lngE6,
        eventType: "ANOMALY",
        startTime,
        timeZone: "UTC",
        countryCode: "US"
    };

    const allSites = [defaultSite, ...(options.extraSites ?? [])];

    const geocode: SeasonGeocode = {
        seasons: [
            {
                id: seasonId,
                sites: allSites
            }
        ]
    };

    const blueprints: EventBlueprints = {
        events: defaultEvents,
        ornaments: {},
        shardMechanics: {},
        targetMechanics: {},
        ...options.blueprints
    };

    const manifest: SeasonManifest = {
        seasons: [
            {
                id: seasonId,
                name: "Test Season",
                year: 2026,
                overviewUrl: "",
                components: [
                    {
                        eventType: "ANOMALY",
                        startTime: "12:00",
                        mechanics: {
                            shards: {
                                shardMechanics: "test-shards",
                                targetMechanics: "test-targets",
                                scoring: {}
                            }
                        }
                    }
                ]
            }
        ]
    };

    return new EventConfigRegistry(blueprints, manifest, geocode);
};
