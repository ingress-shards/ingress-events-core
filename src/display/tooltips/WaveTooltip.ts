import { formatDuration, formatTime, STANDARD_JUMP_WINDOW_DURATION_MS } from "../../common/Date.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { WaveState } from "../../sites/Site.js";
import { formatJumpGroupTime, getShardJumpGroups } from "../ShardJumpGrouper.js";
import { resolveWaveContext } from "./TooltipContext.js";
import type { SiteStateLookup, TooltipContentResolver } from "./TooltipHost.js";

export interface WaveTooltipOptions {
    siteConfig: SiteConfig;
    waveNum: number;
    waveState: WaveState;
}

/**
 * Renders the HTML content for a wave summary scoring popover.
 */
export const renderWaveTooltip = ({
    siteConfig,
    waveNum,
    waveState,
}: WaveTooltipOptions): string => {
    const timeZone = siteConfig.geocode.timeZone ?? "UTC";
    const jumpGroupSize = siteConfig.timeline.jumpGroupSize ?? 1;
    const waveTimeline = siteConfig.timeline.shards.find((shardWave) => shardWave.waveNumber === waveNum);
    const hasTargets = (siteConfig.timeline.targets?.length ?? 0) > 0;

    const shards = (waveState.statistics?.shards?.moving ?? 0) + (waveState.statistics?.shards?.nonMoving ?? 0);
    const targets = waveState.statistics?.targets ?? 0;

    const groups = getShardJumpGroups(waveState.shardJumpWindows, jumpGroupSize);
    const hasDuration = groups.some((g) => g.windows.length === 1 && (g.windows[0]?.actionCount ?? 0) > 3);

    const tableRows = groups.map((group) => {
        const timeStr = formatJumpGroupTime(group, timeZone);
        const totalActions = group.windows.reduce((sum, w) => sum + w.actionCount, 0);

        let durationCell = "";
        if (hasDuration) {
            let durationStr = "-";
            let isWarning = false;
            const singleWin = group.windows.length === 1 ? group.windows[0] : undefined;
            if (singleWin && singleWin.actionCount > 3) {
                const diffMs = Math.max(0, singleWin.actualEnd - singleWin.scheduledStart);
                durationStr = formatDuration(singleWin.scheduledStart, singleWin.actualEnd, "narrow", "seconds");
                isWarning = diffMs > STANDARD_JUMP_WINDOW_DURATION_MS;
            }
            durationCell = `<td${isWarning ? ' class="tooltip-mismatch"' : ""}>${durationStr}</td>`;
        }

        return `
            <tr>
                <td>${group.label}<span class="tooltip-inline-time">${timeStr}</span></td>
                <td>${totalActions}</td>${durationCell}
            </tr>`;
    }).join("");

    const startTimeStr = waveTimeline ? formatTime(waveTimeline.start, timeZone) : "?";
    const endTimeStr = waveTimeline ? formatTime(waveTimeline.end, timeZone) : "?";
    const waveItemsHtml = hasTargets ? `Shards: ${shards} / Targets: ${targets}` : `Shards: ${shards}`;

    return `
        <div class="tooltip tooltip-wave">
            <header class="tooltip-header">
                <strong>Wave ${waveNum} Summary</strong>
                <time>${startTimeStr} - ${endTimeStr}</time>
                <small>${waveItemsHtml}</small>
            </header>
            <table class="tooltip-table">
                <thead>
                    <tr>
                        <th>Jump</th>
                        <th>Actions</th>${hasDuration ? "<th>Duration</th>" : ""}
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`;
};

/**
 * Creates a DOM tooltip resolver for `[data-tooltip-type="wave"]` triggers.
 */
export const createWaveTooltipResolver = (
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): TooltipContentResolver => async (trigger) => {
    const context = await resolveWaveContext(trigger, configRegistry, getSiteState);
    if (!context) return;

    return renderWaveTooltip(context);
};
