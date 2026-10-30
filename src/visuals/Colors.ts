/**
 * UI and Brand-specific constants for Ingress Shards applications.
 */

/**
 * Shared alignment color palette.
 * Covers all alignments (RES, ENL, MAC, NEU).
 */
export const ALIGNMENT_COLORS = {
    /** Resistance Blue */
    RES: "#0088FF",
    /** Enlightened Green */
    ENL: "#03DC03",
    /** Machina Red */
    MAC: "#FF0028",
    /** Neutral Orange */
    NEU: "#FF6600",
} as const;

/**
 * @deprecated Use `ALIGNMENT_COLORS` instead. Slated for removal during Phase 5 (Display Integration).
 */
export const FACTION_COLORS = ALIGNMENT_COLORS;

/**
 * UI State and Secondary color palette.
 */
export const UI_COLORS = {
    /** Color for tied scores (Anomaly/Skirmish) */
    TIE: "#AF00FF",
    /** Color for signal portals or specific interactive feedback */
    SIGNAL: "#FFCC00",
    /** Color for missing or incomplete data states */
    NO_DATA: "#777777",
    /** Grayed out state for portals without current shard activity */
    ORNAMENT_ONLY: "#BDBDBD",
} as const;
