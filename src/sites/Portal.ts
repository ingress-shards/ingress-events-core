import type { Coordinates } from "../common/Geo.js";
import type { PortalGuid } from "../common/Identifiers.js";

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
    /** 
     * Chronological history of observations for this portal.
     */
    history: PortalHistoryEntry[];
}

export type PortalHistoryType = "target" | "beacon" | "recursive" | "pre-event";

export type TargetOrnament = "targetres" | "targetenl";

export type BeaconOrnament = 
    | "peBB_BATTLE_RARE" 
    | "ap1" 
    | "ap1_v" 
    | "peBN_ENL_WINNER" 
    | "peBN_RES_WINNER" 
    | "peBN_TIED_WINNER";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type PreEventOrnament = "nl-1331-2026" | "ap1" | "ap2" | "ap3" | string;

/**
 * Base historical entry for a portal.
 */
export interface BasePortalHistoryEntry {
    /** Epoch time in milliseconds */
    timestamp: number;
    /** The specific characteristic observed */
    type: PortalHistoryType;
}

export interface TargetHistoryEntry extends BasePortalHistoryEntry {
    type: "target";
    /** Target portal identifier */
    ornId: TargetOrnament;
}

export interface BeaconHistoryEntry extends BasePortalHistoryEntry {
    type: "beacon";
    /** The specific ornament ID for the beacon */
    ornId: BeaconOrnament;
}

export interface RecursiveHistoryEntry extends BasePortalHistoryEntry {
    type: "recursive";
    /** Bonus multiplier */
    bonus: number;
}

export interface PreEventHistoryEntry extends BasePortalHistoryEntry {
    type: "pre-event";
    /** Internal ornament identifier for pre-event ornaments */
    ornId: PreEventOrnament;
}

export type PortalHistoryEntry = 
    | TargetHistoryEntry 
    | BeaconHistoryEntry 
    | RecursiveHistoryEntry 
    | PreEventHistoryEntry;
