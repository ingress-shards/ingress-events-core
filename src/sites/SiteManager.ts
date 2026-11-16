import { toZonedDateTimeISO } from "temporal-polyfill/fns/Instant";
import {
    add as zdtAdd,
    subtract as zdtSubtract,
    compare as zdtCompare,
    type Record as ZonedDateTimeRecord,
} from "temporal-polyfill/fns/ZonedDateTime";
import { instant } from "temporal-polyfill/fns/Now";
import { fromFields as durationFromFields } from "temporal-polyfill/fns/Duration";
import type { ShardMechanics, HostSite } from "../types/index.js";
import { PhaseDisplayNames, SitePhase } from "./Site.js";
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
        const standbyThreshold = zdtSubtract(startTime, durationFromFields({ minutes: 15 }));
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
    getExpectedShardCount: (shardMechanics: ShardMechanics, hostSite?: HostSite): number => {
        if (hostSite?.shardCounts && hostSite.shardCounts.length > 0) {
            return hostSite.shardCounts.reduce((a, b) => a + b, 0);
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
        fromMs,
        toMs,
    }: {
        phase: SitePhase;
        fromMs?: number;
        toMs?: number;
    }): string => {
        const hasRange = fromMs !== undefined && toMs !== undefined;

        // 1. Scheduled / Discovery
        if (phase === SitePhase.Scheduled || phase === SitePhase.Discovery) {
            if (hasRange) {
                return `Starts in ${formatDuration(fromMs, toMs)}`;
            }
            return "Starts soon";
        }

        // 2. Stand By
        if (phase === SitePhase.StandBy) {
            if (hasRange) {
                return `Stand By · ${formatDuration(fromMs, toMs)}`;
            }
            return "Stand By";
        }

        // 3. Active
        if (phase === SitePhase.Active) {
            if (hasRange) {
                return `Active · ${formatDuration(fromMs, toMs)}`;
            }
            return "Active";
        }

        // 4. Fallback to display names for other phases (Complete, Processing, etc.)
        return PhaseDisplayNames[phase] || "Unknown";
    },
};
