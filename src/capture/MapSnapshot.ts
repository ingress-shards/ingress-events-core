import type { PortalGuid } from "../common/Identifiers.js";
import type { Coordinates } from "../common/Geo.js";

export interface MapPortalCapture extends Coordinates {
    title: string;
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
