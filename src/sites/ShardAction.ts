import type { ShardAction } from "./Shard.js";

/**
 * Domain-specific logic and factory for ShardAction.
 */
export const ShardActionFactory = {
    VALID_ACTIONS: ["spawn", "link", "jump", "no move", "despawn"] as ShardAction[],

    /**
     * Robustly parses a string into a valid ShardAction.
     * Throws an error if the value is invalid.
     */
    fromString: function (value: string): ShardAction {
        const normalized = value.toLowerCase();
        if (this.VALID_ACTIONS.includes(normalized as ShardAction)) {
            return normalized as ShardAction;
        }
        throw new Error(`Invalid ShardAction: ${value}`);
    },
};
