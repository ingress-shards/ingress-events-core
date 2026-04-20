import type { SeasonEvent } from "./Season.js";

/**
 * Domain-specific logic and factory for SeasonEvent.
 */
export const SeasonEventFactory = {
    VALID_IDS: [
        "ANOMALY",
        "SKIRMISH",
        "INVESTIGATION",
        "SINGULAR",
        "STORM",
        "SINGLE_SHARD",
        "MULTIPLE_SHARDS",
        "UNKNOWN",
    ] as SeasonEvent[],

    /**
     * Robustly parses a string into a valid SeasonEvent.
     * Throws an error if the value is invalid.
     */
    fromString: function (value: string): SeasonEvent {
        const normalized = value.toUpperCase();
        if (this.VALID_IDS.includes(normalized as SeasonEvent)) {
            return normalized as SeasonEvent;
        }
        throw new Error(`Invalid SeasonEvent: ${value}`);
    },
};
