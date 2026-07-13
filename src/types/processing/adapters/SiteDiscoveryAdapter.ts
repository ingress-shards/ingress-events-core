import type { SiteId } from "../../../common/Identifiers.js";
import type { SiteGeocode } from "../../config/Geocode.js";
import type { SiteObservation } from "../../../sites/Site.js";
import type { ObservedPortal } from "../../../sites/Portal.js";
import type { SiteDiscovery } from "../../data-files/SiteDiscovery.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";

export class SiteDiscoveryAdapter implements DataObservationAdapter<SiteDiscovery> {
    private portalIdMapper = new PortalIdMapper();

    public parseAndGroup(input: SiteDiscovery, activeSites: SiteGeocode[]): Map<SiteId, SiteObservation> {
        const grouped = new Map<SiteId, SiteObservation>();
        
        const siteId = input.siteId;
        const siteExists = activeSites.some(s => s.id === siteId);
        if (!siteExists) {
            console.warn(`[SiteDiscoveryAdapter] SiteId "${siteId}" not found in activeSites. Skipping.`);
            return grouped;
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
            grouped.set(siteId, { portals });
        }
        return grouped;
    }
}
