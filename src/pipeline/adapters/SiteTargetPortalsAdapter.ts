import type { SiteRecord } from "../../sites/Site.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { SiteTargetPortals } from "../../types/observations/SiteTargetPortals.js";
import type { DataObservationAdapter, IngestionItem } from "./DataObservationAdapter.js";
import { PortalIdMapper } from "./AdapterHelpers.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import { instant } from "temporal-polyfill/fns/Now";
import { parseTimestampFromFilename } from "../../common/Date.js";

export class SiteTargetPortalsAdapter implements DataObservationAdapter<SiteTargetPortals> {
    private readonly filenamePattern = /^target-portals.*\.json$/i;
    private portalIdMapper = new PortalIdMapper();

    constructor(private readonly candidateSites: SiteConfig[]) {}

    public tryParse(item: IngestionItem): SiteTargetPortals | undefined {
        if (!this.filenamePattern.test(item.filename)) return undefined;
        
        try {
            const targetPortals: Partial<SiteTargetPortals> =
                typeof item.data === "string" ? JSON.parse(item.data) : (item.data as Partial<SiteTargetPortals>);

            if (Array.isArray(targetPortals.artifact) && Boolean(targetPortals.siteId)) {
                if (!targetPortals.exportedAt) {
                    const timestamp = parseTimestampFromFilename(item.filename);
                    if (timestamp) {
                        targetPortals.exportedAt = timestamp;
                    }
                }
                return targetPortals as SiteTargetPortals;
            }
        } catch (error) {
            console.error(`[SiteTargetPortalsAdapter] Failed to parse JSON from ${item.filename}:`, error);
        }
        return undefined;
    }

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
                    lastUpdated: instant().epochMilliseconds,
                },
                observations: { portals },
            }];
        }
        return [];
    }
}
