import type { Coordinates } from "../common/Geo.js";
import type { PortalGuid } from "../common/Identifiers.js";
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
    /** 
     * Chronological history of observations for this portal.
     */
    history: PortalHistoryEntry[];
}

export type PortalHistoryType = "target" | "beacon" | "recursive" | "ornament";

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
    /** Faction alignment */
    team: FactionId;
}

export type BeaconOrnament = 
    | "peBB_BATTLE_RARE" 
    | "ap1" 
    | "ap1_v" 
    | "peBN_ENL_WINNER" 
    | "peBN_RES_WINNER" 
    | "peBN_TIED_WINNER";

export interface BeaconHistoryEntry extends BasePortalHistoryEntry {
    type: "beacon";
    /** The specific ornament ID for the beacon */
    beaconOrnament: BeaconOrnament;
}

export interface RecursiveHistoryEntry extends BasePortalHistoryEntry {
    type: "recursive";
    /** Bonus multiplier */
    bonus: number;
}

export interface OrnamentHistoryEntry extends BasePortalHistoryEntry {
    type: "ornament";
    /** Internal ornament identifier */
    ornamentId: string;
}

export type PortalHistoryEntry = 
    | TargetHistoryEntry 
    | BeaconHistoryEntry 
    | RecursiveHistoryEntry 
    | OrnamentHistoryEntry;
