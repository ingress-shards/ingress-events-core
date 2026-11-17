import type { FactionId } from "../common/Alignment.js";
import { roundToDecimalPlaces } from "../common/Math.js";
import type { ShardWaveTimeline, SiteConfig } from "../config/SiteConfig.js";
import type { SeasonPointsResult } from "../sites/Scoring.js";
import type { SiteAnalysis, SiteState } from "../sites/Site.js";

const FACTION_HEADERS = `
    <th class="faction-enl">ENL</th>
    <th class="faction-res">RES</th>`;

const formatPoints = (value: number): string => roundToDecimalPlaces(value, 1).toString();

const renderCell = (
    value: number,
    faction: FactionId,
    type: "goals" | "links",
    waveNum: number,
    siteId: string,
): string => {
    if (value <= 0) {
        return `<td>${value}</td>`;
    }
    return `
        <td data-tooltip-type="${type}" data-site-id="${siteId}" data-wave="${waveNum}" data-faction="${faction}">
            <span class="scoring-clickable">${value}</span>
        </td>`;
};

const renderColGroup = (hasGoals: boolean): string => {
    const colWidths = hasGoals ? [16, 14, 14, 14, 14, 14, 14] : [20, 20, 20, 20, 20];
    const cols = colWidths.map((w, index) => {
        if (index === 0) return `<col style="width: ${w}%;" />`;
        const bgClass = index % 2 === 1 ? "faction-enl-bg" : "faction-res-bg";
        return `<col class="${bgClass}" style="width: ${w}%;" />`;
    }).join("");
    return `<colgroup>${cols}</colgroup>`;
};

const renderHeader = (hasGoals: boolean): string => {
    const headerGroupCount = hasGoals ? 3 : 2;
    return `
        <thead>
            <tr>
                <th rowspan="2">Wave</th>
                ${hasGoals ? `<th colspan="2">Goal</th>` : ""}
                <th colspan="2">Jumps</th>
                <th colspan="2">Points</th>
            </tr>
            <tr>${FACTION_HEADERS.repeat(headerGroupCount)}
            </tr>
        </thead>`;
};

const renderTotalRow = (
    hasGoals: boolean,
    seasonPointsResult: SeasonPointsResult | undefined,
    sumEnlightened: number,
    sumResistance: number,
): string => {
    const pointsLabel = seasonPointsResult ? "SEASON POINTS" : "POINTS";
    const totalEnlightened = seasonPointsResult ? (seasonPointsResult.points?.ENL ?? 0) : sumEnlightened;
    const totalResistance = seasonPointsResult ? (seasonPointsResult.points?.RES ?? 0) : sumResistance;

    return `
    <tr class="scoring-total-row">
        <td colspan="${hasGoals ? 5 : 3}">${pointsLabel}</td>
        <td class="faction-enl font-bold">${formatPoints(totalEnlightened)}</td>
        <td class="faction-res font-bold">${formatPoints(totalResistance)}</td>
    </tr>`;
};

const renderBody = (
    waves: ShardWaveTimeline[],
    analysis: SiteAnalysis,
    siteId: string,
    hasGoals: boolean,
): string => {
    const contributingEnlightened = analysis.seasonPointsResult?.contributingWaves?.ENL ?? [];
    const contributingResistance = analysis.seasonPointsResult?.contributingWaves?.RES ?? [];

    const rowHtmlParts: string[] = [];
    let sumEnlightened = 0;
    let sumResistance = 0;

    for (const wave of waves) {
        const waveState = analysis.waves[wave.waveNumber];
        if (!waveState || waveState.shardJumpWindows.length === 0) continue;

        const goalsEnlightened = waveState.points?.goals?.ENL ?? 0;
        const goalsResistance = waveState.points?.goals?.RES ?? 0;
        const linksEnlightened = waveState.points?.links?.ENL ?? 0;
        const linksResistance = waveState.points?.links?.RES ?? 0;
        const totalEnlightened = waveState.points?.total?.ENL ?? 0;
        const totalResistance = waveState.points?.total?.RES ?? 0;

        sumEnlightened += totalEnlightened;
        sumResistance += totalResistance;

        const enlightenedClass = contributingEnlightened.includes(wave.waveNumber) ? ' class="scoring-contributor-enl"' : "";
        const resistanceClass = contributingResistance.includes(wave.waveNumber) ? ' class="scoring-contributor-res"' : "";
        const goalsCells = hasGoals
            ? `${renderCell(goalsEnlightened, "ENL", "goals", wave.waveNumber, siteId)}${renderCell(goalsResistance, "RES", "goals", wave.waveNumber, siteId)}`
            : "";

        rowHtmlParts.push(`
            <tr>
                <td data-tooltip-type="wave" data-site-id="${siteId}" data-wave="${wave.waveNumber}">
                    <span class="scoring-clickable">${wave.waveNumber}</span>
                </td>${goalsCells}${renderCell(linksEnlightened, "ENL", "links", wave.waveNumber, siteId)}${renderCell(linksResistance, "RES", "links", wave.waveNumber, siteId)}
                <td${enlightenedClass}>${totalEnlightened}</td>
                <td${resistanceClass}>${totalResistance}</td>
            </tr>`);
    }

    if (rowHtmlParts.length === 0) return "";

    return `
        <tbody>
            ${rowHtmlParts.join("")}
            ${renderTotalRow(hasGoals, analysis.seasonPointsResult, sumEnlightened, sumResistance)}
        </tbody>`;
};

/**
 * Renders the wave-by-wave scoring table HTML for a site.
 * Returns an empty string when analysis is absent or no shard jump windows have been observed.
 */
export const renderScoringTable = (siteConfig: SiteConfig, siteState?: SiteState): string => {
    const analysis = siteState?.analysis;
    const waves = siteConfig.timeline?.shards ?? [];
    if (!analysis || waves.length === 0) return "";

    const firstWave = waves[0];
    const firstWaveState = firstWave ? analysis.waves[firstWave.waveNumber] : undefined;
    if (!firstWaveState || firstWaveState.shardJumpWindows.length === 0) return "";

    const hasGoals = (siteConfig.timeline.targets?.length ?? 0) > 0;
    const bodyHtml = renderBody(waves, analysis, siteConfig.geocode.id, hasGoals);
    if (!bodyHtml) return "";

    return `
        <table class="scoring-table">
            ${renderColGroup(hasGoals)}
            ${renderHeader(hasGoals)}
            ${bodyHtml}
        </table>`;
};
