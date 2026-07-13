import type { SiteId } from "../../../common/Identifiers.js";
import type { SiteGeocode } from "../../config/Geocode.js";
import type { SiteObservation } from "../../../sites/Site.js";
import type { MapSnapshot } from "../../capture/MapSnapshot.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import type { Ornament } from "../../config/EventBlueprints.js";
import { isWithinSiteRange } from "../../../common/Geo.js";
import { getOrCreateSiteBucket, PortalIdMapper } from "../AdapterHelpers.js";
import { PORTAL_HISTORY_TYPES } from "../../../sites/Portal.js";
import type { PortalHistoryType } from "../../../sites/Portal.js";
import * as Now from "temporal-polyfill/fns/now";
import * as Instant from "temporal-polyfill/fns/instant";

export class MapSnapshotAdapter implements DataObservationAdapter<MapSnapshot> {
    private portalIdMapper = new PortalIdMapper();

    constructor(
        private blueprintOrnaments: Record<string, Ornament>,
        private timestampMs: number = Instant.epochMilliseconds(Now.instant())
    ) {}

    public parseAndGroup(input: MapSnapshot, activeSites: SiteGeocode[]): Map<SiteId, SiteObservation> {
        const grouped = new Map<SiteId, SiteObservation>();

        const findSiteForCoords = (latE6: number, lngE6: number): SiteGeocode | undefined => {
            return activeSites.find(site => isWithinSiteRange(site, { latE6, lngE6 }));
        };

        for (const p of input.portals ?? []) {
            const site = findSiteForCoords(p.latE6, p.lngE6);
            if (!site) continue;

            const bucket = getOrCreateSiteBucket(grouped, site.id);
            const portalId = this.portalIdMapper.getOrCreatePortalId(site.id, p.latE6, p.lngE6);

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
                bucket.portals ??= {};
                bucket.portals[portalId] = {
                    ...p,
                    history: historyEntries
                };
            }
        }

        return grouped;
    }
}
