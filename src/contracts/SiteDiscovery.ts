import type { SiteId } from "../common/Identifiers.js";
import type { Portal } from "../sites/Portal.js";

/**
 * Standardized snapshot from the IITC plugin.
 * Used during the Discovery/Collection phase.
 */
export interface SiteDiscovery {
    siteId: SiteId;
    /** The timestamp of the export action itself (epoch ms) */
    exportedAt: number;
    /** Array of detected portals and their observed state */
    portals: PortalDiscovery[];
}

export interface PortalDiscovery extends Portal {
    /** The mandatory ornament found during discovery (e.g., "ap1") */
    ornamentId: string;
}
