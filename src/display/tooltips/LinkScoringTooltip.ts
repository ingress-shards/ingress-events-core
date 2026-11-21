import type { FactionId } from "../../common/Alignment.js";
import { roundToDecimalPlaces } from "../../common/Math.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { WaveState } from "../../sites/Site.js";
import type { ShardLinkScoringRule } from "../../types/config/EventBlueprints.js";
import { formatJumpGroupTime, getShardJumpGroups } from "../ShardJumpGrouper.js";
import { resolveFactionWaveContext } from "./TooltipContext.js";
import type { SiteStateLookup, TooltipContentResolver } from "./TooltipHost.js";

export interface LinkScoringTooltipOptions {
    siteConfig: SiteConfig;
    waveState: WaveState;
    faction: FactionId;
    linkRules: Record<string, ShardLinkScoringRule>;
}

/**
 * Renders the HTML content for a link-scoring breakdown popover.
 */
export const renderLinkScoringTooltip = ({
    siteConfig,
    waveState,
    faction,
    linkRules,
}: LinkScoringTooltipOptions): string => {
    const timeZone = siteConfig.geocode.timeZone ?? "UTC";
    const jumpGroupSize = siteConfig.timeline.jumpGroupSize ?? 1;
    const factionClass = faction.toLowerCase();
    const groups = getShardJumpGroups(waveState.shardJumpWindows, jumpGroupSize);

    const matchedRuleKeys = new Set<string>();
    for (const win of waveState.shardJumpWindows) {
        const linkEntries = Object.entries(win.linksBreakdown?.[faction] ?? {});
        for (const [ruleKey, count] of linkEntries) {
            if (count && count > 0) matchedRuleKeys.add(ruleKey);
        }
    }

    const matchedRules = [...matchedRuleKeys]
        .map((key) => {
            const rule = linkRules[key];
            return rule ? ([key, rule] as const) : undefined;
        })
        .filter((entry): entry is readonly [string, ShardLinkScoringRule] => Boolean(entry));

    const groupHeaders = groups
        .map((group) => `<th>${group.label}<br><small>${formatJumpGroupTime(group, timeZone)}</small></th>`)
        .join("");

    let tableRows = matchedRules.map(([ruleKey, rule]) => {
        let totalJumps = 0;
        const rowCells = groups.map((group) => {
            const count = group.windows.reduce((sum, w) => sum + (w.linksBreakdown?.[faction]?.[ruleKey] ?? 0), 0);
            totalJumps += count;
            return `<td>${count > 0 ? count : "-"}</td>`;
        }).join("");

        const pointsEarned = roundToDecimalPlaces(totalJumps * rule.points, 2);
        return `
            <tr>
                <td>${rule.label} (${rule.points}pt)</td>
                ${rowCells}
                <td class="faction-${factionClass} font-bold">${pointsEarned > 0 ? `${pointsEarned} pts` : "-"}</td>
            </tr>`;
    }).join("");

    const hasMismatches = waveState.shardJumpWindows.some((w) => (w.mismatchedScoringJumps?.[faction] ?? 0) > 0);
    if (hasMismatches) {
        const mismatchCells = groups.map((group) => {
            const count = group.windows.reduce((sum, w) => sum + (w.mismatchedScoringJumps?.[faction] ?? 0), 0);
            return `<td>${count > 0 ? count : "-"}</td>`;
        }).join("");

        tableRows += `
            <tr class="tooltip-mismatch">
                <td>Mismatched Jumps</td>
                ${mismatchCells}
                <td>-</td>
            </tr>`;
    }

    return `
        <div class="tooltip tooltip-links faction-${factionClass}">
            <table class="tooltip-table">
                <thead>
                    <tr>
                        <th>Rule</th>
                        ${groupHeaders}
                        <th>Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows || `<tr><td colspan="${groups.length + 2}">No links scored</td></tr>`}
                </tbody>
            </table>
        </div>`;
};

/**
 * Creates a DOM tooltip resolver for `[data-tooltip-type="links"]` triggers.
 */
export const createLinkScoringTooltipResolver = (
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): TooltipContentResolver => async (trigger) => {
    const context = await resolveFactionWaveContext(trigger, configRegistry, getSiteState);
    if (!context) return;

    const linkKeys = context.seasonEvent?.mechanics.shards?.scoring?.linkRules ?? [];
    const linkRules = Object.fromEntries(
        linkKeys.flatMap((key) => {
            const rule = configRegistry.blueprints.linkScoringRules?.[key];
            return rule ? [[key, rule]] : [];
        }),
    );

    return renderLinkScoringTooltip({
        siteConfig: context.siteConfig,
        waveState: context.waveState,
        faction: context.faction,
        linkRules,
    });
};
