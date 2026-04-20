import type { EventBlueprints } from "../contracts/EventBlueprints.js";
import type { SeasonGeocode } from "../contracts/Geocode.js";
import type { SeasonManifest } from "../contracts/Manifest.js";
import type { SeasonId } from "../common/Identifiers.js";
import type { SeasonConfig } from "./SeasonConfig.js";

export const buildSeasonConfig = ({
    eventBlueprints,
    seasonManifest,
    seasonGeocode,
}: {
    eventBlueprints: EventBlueprints;
    seasonManifest: SeasonManifest;
    seasonGeocode: SeasonGeocode;
}): Record<SeasonId, SeasonConfig> => {
    const seasonConfigCache: Record<SeasonId, SeasonConfig> = {};

    // 2. Build out site configurations referencing geocode data
    for (const season of seasonGeocode.seasons) {
        let configEntry = seasonConfigCache[season.id];
        if (!configEntry) {
            const seasonMetadata = seasonManifest.seasons.find((s) => s.id === season.id);
            if (!seasonMetadata) continue;
            configEntry = seasonConfigCache[season.id] = {
                metadata: seasonMetadata,
                sites: {},
            };
        }

        const seasonMetadata = configEntry.metadata;
        const siteConfigCache = configEntry.sites;

        for (const site of season.sites) {
            const component = seasonMetadata.components.find((c) => c.eventType === site.eventType);

            if (component) {
                const scheduledSite = component.schedule
                    ?.flatMap((s) => s.sites)
                    .find((s) => s.latE6 === site.latE6 && s.lngE6 === site.lngE6);

                let shard = component.shardMechanics
                    ? eventBlueprints.shardMechanics[component.shardMechanics]
                    : undefined;

                if (scheduledSite?.shardCounts && shard) {
                    shard = structuredClone(shard);
                    shard.waves.forEach((wave, index) => {
                        const customCount = scheduledSite.shardCounts?.[index];
                        if (customCount !== undefined) {
                            wave.quantity = customCount;
                        }
                    });
                }

                siteConfigCache[site.id] = {
                    geocode: site,
                    ...(shard && { shardMechanics: shard }),
                    ...(component.targetMechanics && {
                        targetMechanics: eventBlueprints.targetMechanics[component.targetMechanics],
                    }),
                };
            } else {
                siteConfigCache[site.id] = { geocode: site };
            }
        }
    }

    return seasonConfigCache;
};
