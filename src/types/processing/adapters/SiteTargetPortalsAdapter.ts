import type { SiteId } from "../../../common/Identifiers.js";
import type { SiteGeocode } from "../../config/Geocode.js";
import type { SiteObservation } from "../../../sites/Site.js";
import type { ObservedPortal } from "../../../sites/Portal.js";
import type { SiteTargetPortals } from "../../data-files/SiteTargetPortals.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";

export class SiteTargetPortalsAdapter implements DataObservationAdapter<SiteTargetPortals> {
    private portalIdMapper = new PortalIdMapper();

    public parseAndGroup(input: SiteTargetPortals, activeSites: SiteGeocode[]): Map<SiteId, SiteObservation> {
        const grouped = new Map<SiteId, SiteObservation>();
        
        const siteId = input.siteId;
        const siteExists = activeSites.some(s => s.id === siteId);
        if (!siteExists) {
            console.warn(`[SiteTargetPortalsAdapter] SiteId "${siteId}" not found in activeSites. Skipping.`);
            return grouped;
        }

        const portals: Record<number, ObservedPortal> = {};

        for (const art of input.artifact) {
            const ornId = art.id; // e.g. "ap1" or target identifier
            if (ornId !== "targetres" && ornId !== "targetenl") {
                console.warn(`[SiteTargetPortalsAdapter] Invalid target ornament ID "${ornId}". Skipping.`);
                continue;
            }
            if (!art.target) continue;

            for (const t of art.target) {
                const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, t.portalInfo.latE6, t.portalInfo.lngE6);
                const timestampMs = t.observedAt;

                portals[portalId] = {
                    ...t.portalInfo,
                    history: [
                        {
                            timestamp: timestampMs,
                            type: "target",
                            ornId: ornId,
                        }
                    ]
                };
            }
        }

        if (Object.keys(portals).length > 0) {
            grouped.set(siteId, { portals });
        }
        return grouped;
    }
}
