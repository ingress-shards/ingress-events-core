import type { SiteId } from "../../../common/Identifiers.js";
import type { SiteRecord } from "../../../sites/Site.js";
import type { MapSnapshot } from "../../capture/MapSnapshot.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import type { Ornament } from "../../config/EventBlueprints.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { PORTAL_HISTORY_TYPES } from "../../../sites/Portal.js";
import type { PortalHistoryType } from "../../../sites/Portal.js";
import * as Now from "temporal-polyfill/fns/now";
import * as Instant from "temporal-polyfill/fns/instant";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";

export class MapSnapshotAdapter implements DataObservationAdapter<MapSnapshot> {
    private portalIdMapper = new PortalIdMapper();

    constructor(
        private blueprintOrnaments: Record<string, Ornament>,
        private timestampMs: number = Instant.epochMilliseconds(Now.instant())
    ) {}

    public parseAndGroupObservations(input: MapSnapshot, config: EventConfigRegistry): SiteRecord[] {
        const siteRecordsMap = new Map<SiteId, SiteRecord>();
        const ignoredSites = new Set<SiteId>();

        for (const p of input.portals ?? []) {
            const match = config.findSiteByCoords(p.latE6, p.lngE6, input.timestamp);
            if (!match) continue;

            const { siteId, seasonId } = match;
            if (ignoredSites.has(siteId)) continue;

            const siteConfig = config.getSiteConfig(siteId);
            const cutoff = siteConfig?.actionSchedule?.preEventCutoff;
            if (cutoff !== undefined && input.timestamp > cutoff) {
                ignoredSites.add(siteId);
                continue;
            }

            let record = siteRecordsMap.get(siteId);
            if (!record) {
                record = {
                    metadata: {
                        siteId,
                        seasonId,
                        lastUpdated: 0,
                    },
                    observations: { portals: {}, shards: {} },
                };
                siteRecordsMap.set(siteId, record);
            }

            const portals = record.observations!.portals!;
            const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, p.latE6, p.lngE6);

            const historyEntries: any[] = [];

            if (p.ornaments) {
                for (const ornId of p.ornaments) {
                    const blueprint = this.blueprintOrnaments[ornId];
                    if (!blueprint) {
                        console.warn(`[MapSnapshotAdapter] Ornament "${ornId}" not found in blueprints. Skipping.`);
                        continue;
                    }

                    // A blueprint ornament can have multiple tags, we use the first tag that is a valid history type
                    const historyType = blueprint.tags.find((tag): tag is PortalHistoryType => 
                        (PORTAL_HISTORY_TYPES as readonly string[]).includes(tag)
                    );
                    if (historyType) {
                        historyEntries.push({
                            type: historyType,
                            timestamp: this.timestampMs,
                            ornId: ornId
                        });
                    }
                }
            }

            // If we found any valid ornament history entries, or if it's an identifiable portal we want to track
            if (historyEntries.length > 0) {
                portals[portalId] = {
                    ...p,
                    history: historyEntries
                };
            }
        }

        return [...siteRecordsMap.values()];
    }
}
