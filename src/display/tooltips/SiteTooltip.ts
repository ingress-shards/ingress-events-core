import { instant as nowInstant } from "temporal-polyfill/fns/Now";
import { formatDate, formatDuration, MS_PER_DAY, MS_PER_MINUTE } from "../../common/Date.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { FactionPoints } from "../../sites/Scoring.js";
import type { SiteAnalysis, SiteState } from "../../sites/Site.js";
import { ALIGNMENT_COLORS } from "../../visuals/Colors.js";
import { resolveSiteContext } from "./TooltipContext.js";
import type { SiteStateLookup, TooltipContentResolver } from "./TooltipHost.js";

export interface SiteTooltipOptions {
    siteConfig: SiteConfig;
    eventTypeLabel: string;
    siteState?: SiteState | undefined;
    nowMs?: number | undefined;
}

const renderScoresSummary = (scores: FactionPoints): string => {
    const resistance = scores.RES ?? 0;
    const enlightened = scores.ENL ?? 0;
    const machina = scores.MAC ?? 0;
    let html = `<span style="color:${ALIGNMENT_COLORS.RES}">RES: ${resistance} </span><span style="color:${ALIGNMENT_COLORS.ENL}">ENL: ${enlightened} </span>`;
    if (machina > 0) {
        html += `<span style="color:${ALIGNMENT_COLORS.MAC}">MAC: ${machina}</span>`;
    }
    return html;
};

const resolveSiteScores = (analysis?: SiteAnalysis): FactionPoints | undefined => {
    if (analysis?.seasonPointsResult?.points) {
        return analysis.seasonPointsResult.points;
    }

    let resistance = 0;
    let enlightened = 0;
    let machina = 0;
    let hasJumpWindows = false;

    const waves = Object.values(analysis?.waves ?? {});
    for (const wave of waves) {
        if (wave.shardJumpWindows.length > 0) hasJumpWindows = true;
        resistance += wave.points?.total?.RES ?? 0;
        enlightened += wave.points?.total?.ENL ?? 0;
        machina += wave.points?.total?.MAC ?? 0;
    }

    if (!hasJumpWindows && resistance === 0 && enlightened === 0 && machina === 0) {
        return;
    }

    return {
        RES: resistance,
        ENL: enlightened,
        ...(machina > 0 && { MAC: machina }),
    };
};

const countOrnamentedPortals = (siteState?: SiteState): number => {
    let count = 0;
    const portals = Object.values(siteState?.telemetry?.portals ?? {});
    for (const portal of portals) {
        if (portal.history?.some((entry) => "ornId" in entry && Boolean(entry.ornId))) {
            count += 1;
        }
    }
    return count;
};

const hasSiteTelemetry = (siteState?: SiteState): boolean =>
    Object.keys(siteState?.telemetry?.portals ?? {}).length > 0
    || Object.keys(siteState?.telemetry?.shards ?? {}).length > 0;

/**
 * Renders the HTML tooltip for a season/series site marker.
 */
export const renderSiteTooltip = ({
    siteConfig,
    eventTypeLabel,
    siteState,
    nowMs = nowInstant().epochMilliseconds,
}: SiteTooltipOptions): string => {
    const siteName = siteConfig.geocode.name;
    const { start: startTimeMs, durationMinutes } = siteConfig.timeline;
    const timeZone = siteConfig.geocode.timeZone ?? "UTC";
    const { countryCode } = siteConfig.geocode;

    const scores = resolveSiteScores(siteState?.analysis);
    const ornamentCount = countOrnamentedPortals(siteState);
    const hasTelemetry = hasSiteTelemetry(siteState);

    const endTimeMs = startTimeMs + durationMinutes * MS_PER_MINUTE;
    const isBeforeStart = nowMs < startTimeMs;
    const isActive = nowMs >= startTimeMs && nowMs <= endTimeMs;
    const isWithinGrace = nowMs > endTimeMs && nowMs <= endTimeMs + MS_PER_DAY;

    let bannerHtml = "";
    if (isActive) {
        const remaining = formatDuration(nowMs, endTimeMs, "long");
        bannerHtml = `<strong>Site Active</strong> - ${remaining} remaining<hr />`;
    } else if (isWithinGrace && !scores) {
        bannerHtml = `<strong>Site Complete</strong> - <em>compiling XM telemetry.</em><hr />`;
    }

    const flagHtml = countryCode ? `<span class="fi fi-${countryCode.toLowerCase()}"></span> ` : "";
    const countdownSuffix = isBeforeStart ? ` (${formatDuration(nowMs, startTimeMs, "long")})` : "";

    let bodyHtml = "";
    if (scores) {
        bodyHtml = renderScoresSummary(scores);
    } else if (hasTelemetry && ornamentCount > 0) {
        bodyHtml = `<em>${ornamentCount} Ornamented Portal${ornamentCount === 1 ? "" : "s"}</em>`;
    } else if (!isBeforeStart && !isActive && !hasTelemetry) {
        bodyHtml = `<em>No data available</em>`;
    }

    return `<div class="tooltip tooltip-site">${bannerHtml}${flagHtml}<strong>${siteName}</strong><br />Date: ${formatDate(startTimeMs, timeZone)}${countdownSuffix}<br />Type: ${eventTypeLabel}<br />${bodyHtml}</div>`;
};

/**
 * Creates a DOM tooltip resolver for `[data-tooltip-type="site"]` triggers.
 */
export const createSiteTooltipResolver = (
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): TooltipContentResolver => async (trigger) => {
    const context = await resolveSiteContext(trigger, configRegistry, getSiteState);
    if (!context) return;

    const { siteConfig, siteState } = context;
    const eventTypeLabel = configRegistry.blueprints.events[siteConfig.geocode.eventType]?.label
        ?? siteConfig.geocode.eventType;

    return renderSiteTooltip({
        siteConfig,
        siteState,
        eventTypeLabel,
    });
};
