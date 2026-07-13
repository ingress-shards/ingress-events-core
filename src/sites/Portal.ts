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
}

export interface ObservedPortal extends Portal {
    /** 
     * Chronological history of observations for this portal.
     */
    history?: PortalHistoryEntry[];
}

export type PortalHistoryType = "target" | "battle-beacon" | "recursive" | "pre-event";
export const PORTAL_HISTORY_TYPES: readonly PortalHistoryType[] = ["target", "battle-beacon", "recursive", "pre-event"] as const;

/**
 * Base historical entry for a portal.
 */
export interface BasePortalHistoryEntry {
    timestamp: number;
    /** The specific characteristic observed */
    type: PortalHistoryType;
}

export interface TargetHistoryEntry extends BasePortalHistoryEntry {
    type: "target";
    /** Target portal identifier (driven by blueprint keys) */
    ornId: "targetres" | "targetenl";
}

export interface BattleBeaconHistoryEntry extends BasePortalHistoryEntry {
    type: "battle-beacon";
    /** The specific ornament ID for the beacon (driven by blueprint keys) */
    ornId: string;
}

export interface RecursiveHistoryEntry extends BasePortalHistoryEntry {
    type: "recursive";
    /** Bonus multiplier */
    bonus: number;
}

export interface PreEventHistoryEntry extends BasePortalHistoryEntry {
    type: "pre-event";
    /** Internal ornament identifier for pre-event ornaments (driven by blueprint keys) */
    ornId: string;
}

export type PortalHistoryEntry = 
    | TargetHistoryEntry 
    | BattleBeaconHistoryEntry 
    | RecursiveHistoryEntry 
    | PreEventHistoryEntry;
