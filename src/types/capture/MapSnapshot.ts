import type { PortalGuid } from "../../common/Identifiers.js";
import type { Portal } from "../../sites/Portal.js";
import type { SiteDiscovery } from "../data-files/SiteDiscovery.js";

export interface MapPortalCapture extends Portal {
    /**
     * Ingress portal GUID - mandatory for identifiable portals, optional for others.
     */
    guid: PortalGuid;
    /** Raw array of ornament strings (e.g. ["ap1", "volatile"]) */
    ornaments: string[];
}

export interface MapSnapshot {
    timestamp: number;
    portals: MapPortalCapture[];
}

/**
 * Converts a SiteDiscovery payload into a MapSnapshot payload.
 */
export const convertSiteDiscoveryToMapSnapshot = (discovery: SiteDiscovery, timestamp: number): MapSnapshot => {
    return {
        timestamp,
        portals: (discovery.portals ?? []).map((p) => ({
            title: p.title,
            latE6: Math.round(p.lat * 1e6),
            lngE6: Math.round(p.lng * 1e6),
            guid: p.guid ?? "",
            ornaments: [p.ornamentId],
        })),
    };
};
