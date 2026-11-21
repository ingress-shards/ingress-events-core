import type { FactionId } from "../../common/Alignment.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { WaveState } from "../../sites/Site.js";
import type { ShardGoalScoringRule } from "../../types/config/EventBlueprints.js";
import { formatJumpGroupTime, getShardJumpGroups } from "../ShardJumpGrouper.js";
import { resolveFactionWaveContext } from "./TooltipContext.js";
import type { SiteStateLookup, TooltipContentResolver } from "./TooltipHost.js";

export interface GoalScoringTooltipOptions {
    siteConfig: SiteConfig;
    waveState: WaveState;
    faction: FactionId;
    portals?: Record<PortalId, ObservedPortal> | undefined;
    goalRules?: ShardGoalScoringRule[] | undefined;
}

/**
 * Renders the HTML content for a target-goal scoring breakdown popover.
 */
export const renderGoalScoringTooltip = ({
    siteConfig,
    waveState,
    faction,
    portals,
    goalRules = [],
}: GoalScoringTooltipOptions): string => {
    const timeZone = siteConfig.geocode.timeZone ?? "UTC";
    const jumpGroupSize = siteConfig.timeline.jumpGroupSize ?? 1;
    const factionClass = faction.toLowerCase();
    const groups = getShardJumpGroups(waveState.shardJumpWindows, jumpGroupSize);

    const scoredPortalsSet = new Set<number>();
    for (const win of waveState.shardJumpWindows) {
        const goals = win.goalsBreakdown?.[faction] ?? [];
        for (const goal of goals) {
            scoredPortalsSet.add(goal.portalId);
        }
    }

    const pointsLabel = goalRules.length === 1 && goalRules[0] ? ` (${goalRules[0].points}pt)` : "";

    const groupHeaders = groups
        .map((group) => `<th>${group.label}<br><small>${formatJumpGroupTime(group, timeZone)}</small></th>`)
        .join("");

    const tableRows = [...scoredPortalsSet].map((portalId) => {
        const portalName = portals?.[portalId]?.title ?? `Portal ${portalId}`;
        const cells = groups.map((group) => {
            const groupGoals = group.windows
                .flatMap((w) => w.goalsBreakdown?.[faction] ?? [])
                .filter((g) => g.portalId === portalId);
            const scoredValue = groupGoals.reduce((sum, g) => sum + (g.scoredCount ?? 0), 0);
            const unscoredValue = groupGoals.reduce((sum, g) => sum + (g.unscoredCount ?? 0), 0);
            let displayValue = "-";
            if (scoredValue > 0 || unscoredValue > 0) {
                displayValue = unscoredValue > 0 ? `${scoredValue} (${unscoredValue})` : String(scoredValue);
            }
            return `<td>${displayValue}</td>`;
        }).join("");

        return `<tr><td class="portal-name faction-${factionClass} font-bold" title="${portalName}">${portalName}</td>${cells}</tr>`;
    }).join("");

    return `
        <div class="tooltip tooltip-goals faction-${factionClass}">
            <table class="tooltip-table">
                <thead>
                    <tr>
                        <th class="portal-col">Target Portal${pointsLabel}</th>
                        ${groupHeaders}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows || `<tr><td colspan="${groups.length + 1}">No goals scored</td></tr>`}
                </tbody>
            </table>
        </div>`;
};

/**
 * Creates a DOM tooltip resolver for `[data-tooltip-type="goals"]` triggers.
 */
export const createGoalScoringTooltipResolver = (
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): TooltipContentResolver => async (trigger) => {
    const context = await resolveFactionWaveContext(trigger, configRegistry, getSiteState);
    if (!context) return;

    const goalKeys = context.seasonEvent?.mechanics.shards?.scoring?.goalRules ?? [];
    const goalRules = goalKeys.flatMap((key) => {
        const rule = configRegistry.blueprints.goalScoringRules?.[key];
        return rule ? [rule] : [];
    });

    return renderGoalScoringTooltip({
        siteConfig: context.siteConfig,
        waveState: context.waveState,
        faction: context.faction,
        portals: context.siteState.telemetry?.portals,
        goalRules,
    });
};
