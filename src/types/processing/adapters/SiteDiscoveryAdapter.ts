import type { SiteRecord } from "../../../sites/Site.js";
import type { ObservedPortal } from "../../../sites/Portal.js";
import type { SiteDiscovery } from "../../data-files/SiteDiscovery.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";

export class SiteDiscoveryAdapter implements DataObservationAdapter<SiteDiscovery> {
    private portalIdMapper = new PortalIdMapper();

    public parseAndGroupObservations(input: SiteDiscovery, config: EventConfigRegistry): SiteRecord[] {
        const siteId = input.siteId;
        const foundSeasonId = config.getSeasonIdForSite(siteId);

        if (!foundSeasonId) {
            console.warn(`[SiteDiscoveryAdapter] SiteId "${siteId}" not found in season config. Skipping.`);
            return [];
        }

        const portals: Record<number, ObservedPortal> = {};
        const timestampMs = input.exportedAt;

        for (const p of input.portals) {
            const latE6 = Math.round(p.lat * 1000000);
            const lngE6 = Math.round(p.lng * 1000000);
            const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, latE6, lngE6);

            portals[portalId] = {
                title: p.title,
                latE6,
                lngE6,
                history: [
                    {
                        timestamp: timestampMs,
                        type: "pre-event",
                        ornId: p.ornamentId,
                    }
                ]
            };
        }

        if (Object.keys(portals).length > 0) {
            return [{
                metadata: {
                    siteId,
                    seasonId: foundSeasonId,
                    lastUpdated: 0,
                },
                observations: { portals },
            }];
        }
        return [];
    }
}
