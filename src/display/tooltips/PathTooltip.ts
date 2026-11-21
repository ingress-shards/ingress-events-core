import { formatTime } from "../../common/Date.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { ShardPath } from "../../sites/Shard.js";
import { ALIGNMENT_COLORS } from "../../visuals/Colors.js";
import { resolveSiteContext } from "./TooltipContext.js";
import type { SiteStateLookup, TooltipContentResolver } from "./TooltipHost.js";

export interface PathTooltipOptions {
    shardPath: ShardPath;
    portalA: ObservedPortal;
    portalB: ObservedPortal;
    portalAId: PortalId;
    siteConfig?: SiteConfig | undefined;
}

const formatDistance = (distanceMeters: number): string =>
    distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(2)}km`;

/**
 * Renders the HTML tooltip for a shard path (player-created links or random idle teleports).
 */
export const renderPathTooltip = ({
    shardPath,
    portalA,
    portalB,
    portalAId,
    siteConfig,
}: PathTooltipOptions): string => {
    const timeZone = siteConfig?.geocode.timeZone ?? "UTC";
    const distanceDisplay = formatDistance(shardPath.distance);

    if (shardPath.links && shardPath.links.length > 0) {
        const moveOrigins = new Set(shardPath.links.flatMap((link) => link.moves).map((m) => m.origin));
        const isBidirectional = moveOrigins.size > 1;

        let html: string;
        if (isBidirectional) {
            html = `<strong>${portalA.title} (A) &lt;-&gt; ${portalB.title} (B) (${distanceDisplay})</strong><hr />`;
        } else {
            const [originPortalId] = [...moveOrigins];
            const fromPortal = originPortalId === portalAId ? portalA : portalB;
            const toPortal = originPortalId === portalAId ? portalB : portalA;
            html = `<strong>${fromPortal.title} -&gt; ${toPortal.title} (${distanceDisplay})</strong><hr />`;
        }

        const sortedLinks = [...shardPath.links].sort((a, b) => a.linkTime - b.linkTime);
        for (const [index, link] of sortedLinks.entries()) {
            const linkColor = ALIGNMENT_COLORS[link.align] ?? ALIGNMENT_COLORS.NEU;
            html += `Linked at ${formatTime(link.linkTime, timeZone, true)} by <span style="color:${linkColor}">${link.align}</span> <br />`;

            for (const move of link.moves) {
                const moveTime = formatTime(move.moveTime, timeZone, true);
                const direction = isBidirectional ? (move.origin === portalAId ? "(A -> B) " : "(B -> A) ") : "";
                const points = move.totalPoints ?? 0;
                html += `<strong>Shard ${move.shardId}</strong> jumped ${direction}at ${moveTime} for ${points} point${points === 1 ? "" : "s"}<br />`;
            }

            if (index < sortedLinks.length - 1) {
                html += `<hr class="tooltip-sub-divider" />`;
            }
        }

        return `<div class="tooltip tooltip-path">${html}</div>`;
    }

    if (shardPath.teleports && shardPath.teleports.length > 0) {
        const teleport = shardPath.teleports[0]!;
        const fromPortal = teleport.origin === portalAId ? portalA : portalB;
        const toPortal = teleport.origin === portalAId ? portalB : portalA;
        const moveTime = formatTime(teleport.moveTime, timeZone, true);

        return `<div class="tooltip tooltip-path"><strong>${fromPortal.title} -&gt; ${toPortal.title} (${distanceDisplay})</strong><hr /><strong>Shard ${teleport.shardId}</strong> randomly teleported at ${moveTime}<br /></div>`;
    }

    return "";
};

/**
 * Creates a DOM tooltip resolver for `[data-tooltip-type="path"]` triggers.
 */
export const createPathTooltipResolver = (
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): TooltipContentResolver => async (trigger) => {
    const { pathKey } = trigger.dataset;
    if (!pathKey) return;

    const segments = pathKey.split("-");
    if (segments.length !== 2 || !segments[0] || !segments[1]) return;

    const portalAId = Number(segments[0]);
    const portalBId = Number(segments[1]);
    if (Number.isNaN(portalAId) || Number.isNaN(portalBId)) return;

    const context = await resolveSiteContext(trigger, configRegistry, getSiteState);
    if (!context?.siteState) return;

    const shardPath = context.siteState.analysis?.shardPaths?.[pathKey];
    const portalA = context.siteState.telemetry?.portals?.[portalAId];
    const portalB = context.siteState.telemetry?.portals?.[portalBId];
    if (!shardPath || !portalA || !portalB) return;

    const html = renderPathTooltip({
        shardPath,
        portalA,
        portalB,
        portalAId,
        siteConfig: context.siteConfig,
    });
    return html || undefined;
};
