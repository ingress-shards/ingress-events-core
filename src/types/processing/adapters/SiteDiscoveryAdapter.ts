import type { SiteRecord } from "../../../sites/Site.js";
import type { ObservedPortal } from "../../../sites/Portal.js";
import type { SiteDiscovery, PortalDiscovery } from "../../data-files/SiteDiscovery.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import type { SiteConfig } from "../../../config/SiteConfig.js";
import { findSiteByCoords } from "../../../common/Geo.js";
import type { SiteId } from "../../../common/Identifiers.js";

export class SiteDiscoveryAdapter implements DataObservationAdapter<SiteDiscovery> {
    private portalIdMapper = new PortalIdMapper();

    constructor(private readonly candidateSites: SiteConfig[]) {}

    private buildPortalsRecord(siteId: SiteId, portalsList: PortalDiscovery[], fallbackExportedAt?: number): Record<number, ObservedPortal> {
        const portals: Record<number, ObservedPortal> = {};
        const defaultTimestamp = fallbackExportedAt 
            ? (fallbackExportedAt < 1e11 ? fallbackExportedAt * 1000 : fallbackExportedAt) 
            : 0;

        for (const p of portalsList) {
            const latE6 = Math.round(p.lat * 1000000);
            const lngE6 = Math.round(p.lng * 1000000);
            const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, latE6, lngE6);
            const timestamp = p.observedAt ?? defaultTimestamp;

            portals[portalId] = {
                title: p.title,
                latE6,
                lngE6,
                history: [
                    {
                        timestamp,
                        type: "pre-event",
                        ornId: p.ornamentId,
                    }
                ]
            };
        }
        return portals;
    }

    public parseAndGroupObservations(input: SiteDiscovery): SiteRecord[] {
        // 1. Fast-path: Explicit single-site input
        if (input.siteId) {
            const siteId = input.siteId;
            const siteConfig = this.candidateSites.find(s => s.geocode.id === siteId);

            if (!siteConfig) {
                console.warn(`[SiteDiscoveryAdapter] Site config not found: "${siteId}". Skipping.`);
                return [];
            }

            const portals = this.buildPortalsRecord(siteId, input.portals, input.exportedAt);
            if (Object.keys(portals).length > 0) {
                return [{
                    metadata: {
                        siteId,
                        seasonId: siteConfig.seasonId,
                        lastUpdated: 0,
                    },
                    observations: { portals },
                }];
            }
            return [];
        }

        // 2. Spatial matching path: Group portals by matched site from candidate sites
        const portalsBySite = new Map<SiteConfig, PortalDiscovery[]>();

        const defaultTimestamp = input.exportedAt 
            ? (input.exportedAt < 1e11 ? input.exportedAt * 1000 : input.exportedAt) 
            : 0;

        for (const p of input.portals) {
            const latE6 = Math.round(p.lat * 1000000);
            const lngE6 = Math.round(p.lng * 1000000);
            const portalTimestamp = p.observedAt ?? defaultTimestamp;

            const matchedSite = findSiteByCoords(this.candidateSites, latE6, lngE6, portalTimestamp);
            if (!matchedSite) {
                console.warn(`[SiteDiscoveryAdapter] Portal "${p.title}" at (${p.lat}, ${p.lng}) did not match any candidate site. Skipping.`);
                continue;
            }

            let group = portalsBySite.get(matchedSite);
            if (!group) {
                group = [];
                portalsBySite.set(matchedSite, group);
            }
            group.push(p);
        }

        const results: SiteRecord[] = [];
        for (const [siteConfig, sitePortals] of portalsBySite) {
            const siteId = siteConfig.geocode.id;
            const portals = this.buildPortalsRecord(siteId, sitePortals, input.exportedAt);
            if (Object.keys(portals).length > 0) {
                results.push({
                    metadata: {
                        siteId,
                        seasonId: siteConfig.seasonId,
                        lastUpdated: 0,
                    },
                    observations: { portals },
                });
            }
        }

        return results;
    }
}
