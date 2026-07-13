import type { SiteId } from "../../common/Identifiers.js";

/**
 * Standardized snapshot from the IITC plugin.
 * Used during the Discovery/Collection phase.
 */
export interface SiteDiscovery {
    siteId: SiteId;
    /** The timestamp of the export action itself */
    exportedAt: number;
    /** Array of detected portals and their observed state */
    portals: PortalDiscovery[];
}

export interface PortalDiscovery {
    title: string;
    lat: number;
    lng: number;
    /** The mandatory ornament found during discovery (e.g., "ap1") */
    ornamentId: string;
    /** Ingress portal GUID - optional for backwards compatibility */
    guid?: string;
}

