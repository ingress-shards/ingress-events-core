/**
 * Normalized Alignment and Faction Identifiers used across Ingress Shards projects.
 */
import { ALIGNMENT_COLORS } from "../visuals/Colors.js";

/**
 * Factions that actively compete and score points in Ingress events.
 */
export type FactionId = "RES" | "ENL" | "MAC";
export const FACTION_IDS: readonly FactionId[] = ["RES", "ENL", "MAC"] as const;

/**
 * All possible entity alignment states in Ingress, including unaligned (Neutral).
 */
export type Alignment = FactionId | "NEU";

/**
 * Metadata for an Ingress alignment state.
 */
export interface AlignmentMetadata {
    /** The display label used in UI components */
    label: string;
    /** The hex color code used for styling */
    color: string;
    /** The raw string values as they appear in Niantic's input data (e.g. ["RESISTANCE"]) */
    nianticIds: readonly string[];
}

/**
 * Domain knowledge mapping for all Ingress alignment states.
 */
export const ALIGNMENTS: Record<Alignment, AlignmentMetadata> = {
    RES: {
        label: "Resistance",
        nianticIds: ["RESISTANCE"],
        color: ALIGNMENT_COLORS.RES,
    },
    ENL: {
        label: "Enlightened",
        nianticIds: ["ENLIGHTENED", "ALIENS"],
        color: ALIGNMENT_COLORS.ENL,
    },
    MAC: {
        label: "Machina",
        nianticIds: ["MACHINA"],
        color: ALIGNMENT_COLORS.MAC,
    },
    NEU: {
        label: "Neutral",
        nianticIds: ["NEUTRAL"],
        color: ALIGNMENT_COLORS.NEU,
    },
} as const;

/**
 * Converts raw Niantic input data string into a normalized Alignment.
 */
export const fromNianticId = (nianticId: string): Alignment => {
    const upper = nianticId.toUpperCase();
    const entry = Object.entries(ALIGNMENTS).find(([_, meta]) => meta.nianticIds.includes(upper));
    return entry ? (entry[0] as Alignment) : "NEU";
};

/**
 * @deprecated Use AlignmentMetadata instead. Scheduled for removal during Phase 5 (Display Integration).
 */
export type FactionMetadata = AlignmentMetadata;

/**
 * @deprecated Use ALIGNMENTS instead. Scheduled for removal during Phase 5 (Display Integration).
 */
export const FACTIONS = ALIGNMENTS;
