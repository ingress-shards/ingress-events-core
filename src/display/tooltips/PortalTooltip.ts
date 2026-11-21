import type { FactionId } from "../../common/Alignment.js";
import { formatTime } from "../../common/Date.js";
import type { ShardId } from "../../common/Identifiers.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { ShardTelemetryEntry } from "../../sites/Shard.js";
import type { Ornament } from "../../types/config/EventBlueprints.js";
import { ALIGNMENT_COLORS } from "../../visuals/Colors.js";
import { resolveSiteContext } from "./TooltipContext.js";
import type { SiteStateLookup, TooltipContentResolver } from "./TooltipHost.js";

const INGRESS_INTEL_PORTAL_LINK = "https://intel.ingress.com/intel?pll=";

export interface PortalTooltipOptions {
    portal: ObservedPortal;
    shardHistory?: readonly [ShardId, readonly ShardTelemetryEntry[]][] | undefined;
    ornaments?: Record<string, Ornament> | undefined;
    siteConfig?: SiteConfig | undefined;
}

const resolveTargetFaction = (portal: ObservedPortal): FactionId | undefined => {
    const targetEntry = portal.history?.find((entry) => entry.type === "target");
    if (targetEntry?.ornId === "targetres") return "RES";
    if (targetEntry?.ornId === "targetenl") return "ENL";
    return;
};

const formatOrnamentHtml = (portal: ObservedPortal, ornaments: Record<string, Ornament>): string => {
    const ornamentIds = new Set<string>();
    const historyEntries = portal.history ?? [];
    for (const entry of historyEntries) {
        if ("ornId" in entry && entry.ornId) {
            ornamentIds.add(entry.ornId);
        }
    }
    if (ornamentIds.size === 0) return "";

    return [...ornamentIds].map((id) => {
        const brand = ornaments[id];
        const label = brand?.label ? `${brand.label} (${id})` : `Ornament (${id})`;
        return `<i>${label}</i><br/>`;
    }).join("");
};

/**
 * Renders the HTML tooltip for a portal marker (title, Intel link, target/ornament info, and shard telemetry).
 */
export const renderPortalTooltip = ({
    portal,
    shardHistory = [],
    ornaments = {},
    siteConfig,
}: PortalTooltipOptions): string => {
    const timeZone = siteConfig?.geocode.timeZone ?? "UTC";
    const targetFaction = resolveTargetFaction(portal);
    const lat = portal.latE6 / 1e6;
    const lng = portal.lngE6 / 1e6;
    const targetHtml = targetFaction
        ? `<strong><span style="color:${ALIGNMENT_COLORS[targetFaction]}">${targetFaction}</span></strong> <i>Target Portal</i><br/>`
        : "";
    const ornamentHtml = formatOrnamentHtml(portal, ornaments);
    const separator = shardHistory.length > 0 ? "<hr />" : "";

    let html = `<strong>${portal.title}</strong> <a href="${INGRESS_INTEL_PORTAL_LINK}${lat},${lng}" target="intel_page">Intel</a><br/>${targetHtml}${ornamentHtml}${separator}`;

    for (const [index, [shardId, entries]] of shardHistory.entries()) {
        html += `<strong>Shard ${shardId}</strong><br />`;
        for (const entry of entries) {
            const shouldShowTeam = !["no move", "jump"].includes(entry.action);
            const team = shouldShowTeam ? (entry.align ?? "NEU") : undefined;

            let actionLabel: string = entry.action;
            if (entry.action === "link") actionLabel = "jump";
            else if (entry.action === "jump") actionLabel = "randomly teleported";

            const teamHtml = team ? ` - <span style="color:${ALIGNMENT_COLORS[team]}">${team}</span>` : "";
            html += `${actionLabel} at ${formatTime(entry.moveTime, timeZone, true)}${teamHtml}<br />`;
        }

        if (index < shardHistory.length - 1) {
            html += `<hr class="tooltip-sub-divider" />`;
        }
    }

    return `<div class="tooltip tooltip-portal">${html}</div>`;
};

/**
 * Creates a DOM tooltip resolver for `[data-tooltip-type="portal"]` triggers.
 */
export const createPortalTooltipResolver = (
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): TooltipContentResolver => async (trigger) => {
    const { portalId: rawPortalId } = trigger.dataset;
    const portalId = Number(rawPortalId);
    if (!rawPortalId || Number.isNaN(portalId)) return;

    const context = await resolveSiteContext(trigger, configRegistry, getSiteState);
    if (!context?.siteState) return;

    const portal = context.siteState.telemetry?.portals?.[portalId];
    if (!portal) return;

    const shardHistory: [ShardId, ShardTelemetryEntry[]][] = Object.entries(context.siteState.telemetry?.shards ?? {})
        .map(([rawShardId, shard]): [ShardId, ShardTelemetryEntry[]] => [
            Number(rawShardId),
            shard.history.filter((entry) => entry.portalId === portalId),
        ])
        .filter(([, entries]) => entries.length > 0)
        .sort(([shardA], [shardB]) => shardA - shardB);

    return renderPortalTooltip({
        portal,
        shardHistory,
        ornaments: configRegistry.blueprints.ornaments,
        siteConfig: context.siteConfig,
    });
};
