/**
 * Normalized Faction Identifiers used across Ingress Shards projects.
 */
import { FACTION_COLORS } from "../visuals/Colors.js";

export type FactionId = "RES" | "ENL" | "MAC" | "NEU";

/**
 * Metadata for an Ingress Faction.
 */
export interface FactionMetadata {
    /** The display label used in UI components */
    label: string;
    /** The hex color code used for styling */
    color: string;
    /** The raw string value as it appears in Niantic's input data (e.g. "RESISTANCE") */
    nianticId: string;
}

/**
 * Domain knowledge mapping for Ingress factions.
 */
export const FACTIONS: Record<FactionId, FactionMetadata> = {
    RES: {
        label: "Resistance",
        nianticId: "RESISTANCE",
        color: FACTION_COLORS.RES,
    },
    ENL: {
        label: "Enlightened",
        nianticId: "ENLIGHTENED",
        color: FACTION_COLORS.ENL,
    },
    MAC: {
        label: "Machina",
        nianticId: "MACHINA",
        color: FACTION_COLORS.MAC,
    },
    NEU: {
        label: "Neutral",
        nianticId: "NEUTRAL",
        color: FACTION_COLORS.NEU,
    },
} as const;

/**
 * Converts raw Niantic input data string into a normalized FactionId.
 */
export const fromNianticId = (nianticId: string): FactionId => {
    const entry = Object.entries(FACTIONS).find(([_, meta]) => meta.nianticId === nianticId.toUpperCase());
    return entry ? (entry[0] as FactionId) : "NEU";
};
