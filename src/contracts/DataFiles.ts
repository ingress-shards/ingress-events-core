/**
 * Supported data file types for shard-related exports and imports.
 * - shardJumpTimes: Full shard movement history and jump logs.
 * - ornamentedPortals: List of detected ornamented portals from discovery.
 */
export type DataFileType = "shardJumpTimes" | "ornamentedPortals" | "targetPortals" | "recursivePortals";

/**
 * Metadata definition for a shard data file.
 */
export interface DataFileMetadata {
    /** Human-readable label for the data type */
    label: string;
    /** Regular expression for matching filenames during import */
    importPattern: RegExp;
    /** String template or prefix for generating filenames during export */
    exportPrefix: string;
}

/**
 * Standard registry of data files used across the project.
 * The key is the DataFileType.
 */
export const DATA_FILES: Record<DataFileType, DataFileMetadata> = {
    shardJumpTimes: {
        label: "Shard Jump Times",
        importPattern: /^shard-jump-times.*\.json$/i,
        exportPrefix: "shard-jump-times",
    },
    ornamentedPortals: {
        label: "Ornamented Portals",
        importPattern: /^ornamented-portals.*\.json$/i,
        exportPrefix: "ornamented-portals",
    },
    targetPortals: {
        label: "Target Portals",
        importPattern: /^target-portals.*\.json$/i,
        exportPrefix: "target-portals",
    },
    recursivePortals: {
        label: "Recursive Portals",
        importPattern: /^recursive-portals.*\.json$/i,
        exportPrefix: "recursive-portals",
    },
};
