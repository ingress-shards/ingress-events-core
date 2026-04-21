import type { Coordinates } from "../common/Geo.js";
import type { PortalGuid, PortalId } from "../common/Identifiers.js";
import type { FactionId } from "../common/Factions.js";

/**
 * Base Portal information.
 * This represents a Portal as an independent entity in the Ingress world.
 */
export interface Portal extends Coordinates {
    title: string;
    /**
     * Ingress portal GUID - mandatory for identifiable portals, optional for others.
     */
    guid?: PortalGuid;
}

export interface PortalObservation {
    portalId: PortalId;
    /** Epoch time in milliseconds */
    observedAt: number;
    /** The specific characteristic observed (Target, Beacon, etc.) */
    feature: PortalFeature;
}

export type PortalFeature =
    | { type: "tar"; align: FactionId }
    | { type: "bcn" }
    | { type: "rec"; bonus: number }
    | { type: "orn"; ornId: string };
