import type { PortalGuid } from "../common/Identifiers.js";
import type { Portal } from "../sites/Portal.js";

export interface MapPortalCapture extends Portal {
    /**
     * Ingress portal GUID - mandatory for identifiable portals, optional for others.
     */
    guid: PortalGuid;
    /** Raw array of ornament strings (e.g. ["ap1", "volatile"]) */
    ornaments: string[];
}

export interface MapSnapshot {
    portals: MapPortalCapture[];
}
