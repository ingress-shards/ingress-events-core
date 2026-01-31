/**
 * Normalized Faction Identifiers used across Ingress Shards projects.
 */
export type FactionId = "RES" | "ENL" | "MAC" | "NEU";

/**
 * Metadata for an Ingress Faction.
 */
export interface FactionMetadata {
    /** The full display name of the faction */
    name: string;
    /** The canonical hex color code for the faction */
    color: string;
    /** The long-form name used by the Ingress API */
    fullName: string;
}

/**
 * Domain knowledge mapping for Ingress factions.
 */
export const FACTIONS: Record<FactionId, FactionMetadata> = {
    RES: {
        name: "Resistance",
        fullName: "RESISTANCE",
        color: "#0088FF",
    },
    ENL: {
        name: "Enlightened",
        fullName: "ENLIGHTENED",
        color: "#03DC03",
    },
    MAC: {
        name: "Machina",
        fullName: "MACHINA",
        color: "#FF0028",
    },
    NEU: {
        name: "Neutral",
        fullName: "NEUTRAL",
        color: "#FF6600",
    },
} as const;

/**
 * Maps a numeric IITC faction ID to the internal FactionId.
 */
export const fromIitcFaction = (faction: number | string): FactionId => {
    const f = typeof faction === "string" ? parseInt(faction, 10) : faction;
    switch (f) {
        case 1:
            return "ENL";
        case 2:
            return "RES";
        case 3:
            return "MAC";
        default:
            return "NEU";
    }
};

/**
 * Maps an internal FactionId to the numeric IITC faction ID.
 */
export const toIitcFaction = (factionId: FactionId): number => {
    switch (factionId) {
        case "ENL":
            return 1;
        case "RES":
            return 2;
        case "MAC":
            return 3;
        default:
            return 0;
    }
};
