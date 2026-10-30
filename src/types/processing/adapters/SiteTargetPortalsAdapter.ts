import type { SiteRecord } from "../../../sites/Site.js";
import type { ObservedPortal } from "../../../sites/Portal.js";
import type { SiteTargetPortals } from "../../data-files/SiteTargetPortals.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import type { SiteConfig } from "../../../config/SiteConfig.js";

export class SiteTargetPortalsAdapter implements DataObservationAdapter<SiteTargetPortals> {
    private portalIdMapper = new PortalIdMapper();

    constructor(private readonly candidateSites: SiteConfig[]) {}

    public parseAndGroupObservations(input: SiteTargetPortals): SiteRecord[] {
        const siteId = input.siteId;
        const foundSeasonId = this.candidateSites.find(s => s.geocode.id === siteId)?.seasonId;

        if (!foundSeasonId) {
            console.warn(`[SiteTargetPortalsAdapter] Site config not found for "${siteId}". Skipping.`);
            return [];
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

                portals[portalId] = {
                    ...t.portalInfo,
                    history: [
                        {
                            timestamp: t.observedAt,
                            type: "target",
                            ornId: ornId,
                        }
                    ]
                };
            }
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
