import { toZonedDateTimeISO } from "temporal-polyfill/fns/Instant";
import {
    add as zdtAdd,
    subtract as zdtSubtract,
    compare as zdtCompare,
    type Record as ZonedDateTimeRecord,
} from "temporal-polyfill/fns/ZonedDateTime";
import { instant } from "temporal-polyfill/fns/Now";
import { fromFields as durationFromFields } from "temporal-polyfill/fns/Duration";
import type { ShardMechanics, SiteManifestMetadata } from "../types/index.js";
import { PhaseDisplayNames, SitePhase } from "./Site.js";
import type { Temporal } from "temporal-polyfill";
import { formatDuration } from "../common/Date.js";

export interface CalculateSitePhaseParameters {
    /** The start time of the event zoned to the site's coordinates */
    startTime: ZonedDateTimeRecord;
    /** Duration of the event in minutes */
    eventDurationMins: number;
    /** Shard collection counters */
    shards: { actual: number; expected: number };
    /** True if ornaments are present on map */
    hasOrnaments: boolean;
}

/**
 * Domain-specific logic for managing Site state and calculations.
 */
export const SiteManager = {
    /**
     * Determines the lifecycle phase of a site based on timing and shard counts.
     */
    calculatePhase: (
        { startTime, eventDurationMins, shards, hasOrnaments }: CalculateSitePhaseParameters,
        currentTime = instant(),
    ): SitePhase => {
        const endTime = zdtAdd(startTime, durationFromFields({ minutes: eventDurationMins }));
        const standbyThreshold = zdtSubtract(startTime, durationFromFields({ hours: 2 }));
        const staleThreshold = zdtAdd(endTime, durationFromFields({ hours: 24 }));
        const nowZoned = toZonedDateTimeISO(currentTime, startTime.timeZoneId);

        if (zdtCompare(nowZoned, startTime) >= 0 && zdtCompare(nowZoned, endTime) <= 0) {
            return SitePhase.Active;
        }
        if (zdtCompare(nowZoned, standbyThreshold) >= 0 && zdtCompare(nowZoned, startTime) < 0) {
            return SitePhase.StandBy;
        }
        if (zdtCompare(nowZoned, startTime) < 0) {
            return hasOrnaments ? SitePhase.Discovery : SitePhase.Scheduled;
        }
        if (shards.actual >= shards.expected) {
            return SitePhase.Complete;
        }
        if (shards.actual === 0 && zdtCompare(nowZoned, staleThreshold) >= 0) {
            return SitePhase.NoData;
        }
        return SitePhase.Processing;
    },

    /**
     * Calculates the total number of shards expected at a site based on metadata overrides and blueprint mechanics.
     */
    getExpectedShardCount: (shardMechanics: ShardMechanics, metadata?: SiteManifestMetadata): number => {
        if (metadata?.shardCounts && metadata.shardCounts.length > 0) {
            return metadata.shardCounts.reduce((a, b) => a + b, 0);
        }

        const waves = shardMechanics.waves;
        if (!waves || waves.length === 0) {
            throw new Error("Invalid Configuration: No waves defined in shard mechanics.");
        }

        return waves.reduce((sum, wave) => sum + (wave.quantity ?? 1), 0);
    },

    /**
     * Calculates the duration of an event in minutes based on its shard mechanics.
     */
    getEventDuration: (shardMechanics: ShardMechanics): number => {
        const waves = shardMechanics.waves;
        if (!waves || waves.length === 0) {
            throw new Error("Invalid shard mechanics: No waves defined.");
        }

        const lastWaveStart = Math.max(...waves.map((w) => w.startOffset ?? 0));
        const jumpActions = shardMechanics.waveActions?.filter((a) => a.action === "jump") || [];

        if (jumpActions.length === 0) {
            throw new Error("Invalid shard mechanics: No jump actions defined.");
        }

        const lastJumpOffset = Math.max(...jumpActions.map((a) => a.time));
        return lastWaveStart + lastJumpOffset + 1;
    },

    /**
     * Formats a Site's status into a human-readable string for display in UI dialogs.
     */
    formatStatus: ({
        phase,
        timeRemaining,
    }: {
        phase: SitePhase;
        timeRemaining: Temporal.DurationLikeObject | undefined;
    }): string => {
        // 1. Scheduled / Discovery
        if (phase === SitePhase.Scheduled || phase === SitePhase.Discovery) {
            if (timeRemaining) {
                return `Starts in ${formatDuration(timeRemaining)}`;
            }
            return "Starts soon";
        }

        // 2. Active
        if (phase === SitePhase.Active) {
            if (timeRemaining) {
                return `Active · ${formatDuration(timeRemaining)}`;
            }
            return "Active";
        }

        // 3. Fallback to display names for other phases (Complete, Processing, etc.)
        return PhaseDisplayNames[phase] || "Unknown";
    },
};
