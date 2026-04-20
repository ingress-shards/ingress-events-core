import * as Instant from "temporal-polyfill/fns/instant";
import * as ZonedDateTime from "temporal-polyfill/fns/zoneddatetime";
import * as Now from "temporal-polyfill/fns/now";
import * as Duration from "temporal-polyfill/fns/duration";
import type { ShardMechanics } from "../contracts/EventBlueprints.js";
import type { SiteManifestMetadata } from "../contracts/Manifest.js";
import { PhaseDisplayNames, SitePhase } from "./Site.js";
import type { Temporal } from "temporal-polyfill";
import { formatDuration } from "../common/Date.js";

export interface CalculateSitePhaseParameters {
    /** The start time of the event zoned to the site's coordinates */
    startTime: ZonedDateTime.Record;
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
        currentTime = Now.instant(),
    ): SitePhase => {
        const endTime = ZonedDateTime.add(startTime, Duration.fromFields({ minutes: eventDurationMins }));
        const staleThreshold = ZonedDateTime.add(endTime, Duration.fromFields({ hours: 24 }));
        const nowZoned = Instant.toZonedDateTimeISO(currentTime, ZonedDateTime.timeZoneId(startTime));

        if (ZonedDateTime.compare(nowZoned, startTime) >= 0 && ZonedDateTime.compare(nowZoned, endTime) <= 0) {
            return SitePhase.Active;
        } else if (ZonedDateTime.compare(nowZoned, startTime) < 0) {
            return hasOrnaments ? SitePhase.Discovery : SitePhase.Scheduled;
        } else if (shards.actual >= shards.expected) {
            return SitePhase.Complete;
        } else if (shards.actual === 0 && ZonedDateTime.compare(nowZoned, staleThreshold) >= 0) {
            return SitePhase.NoData;
        } else {
            return SitePhase.Processing;
        }
    },

    /**
     * Calculates the total number of shards expected at a site based on metadata overrides and blueprint mechanics.
     */
    getExpectedShardCount: (metadata: SiteManifestMetadata | undefined, shardMechanics: ShardMechanics): number => {
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
        timeRemaining: Temporal.Duration | undefined;
    }): string => {
        // 1. Scheduled / Discovery
        if (phase === SitePhase.Scheduled || phase === SitePhase.Discovery) {
            if (timeRemaining) {
                return `starts in ${formatDuration(timeRemaining)}`;
            }
            return "starts soon";
        }

        // 2. Active
        if (phase === SitePhase.Active) {
            if (timeRemaining) {
                return `<strong>Active</strong> (ends in ${formatDuration(timeRemaining)})`;
            }
            return "<strong>Active</strong>";
        }

        // 3. Fallback to display names for other phases (Complete, Processing, etc.)
        return PhaseDisplayNames[phase] || "Unknown";
    },
};
