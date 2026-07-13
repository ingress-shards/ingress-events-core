import type { SiteId } from "../../common/Identifiers.js";
import type { TargetArtifact } from "../capture/ShardJumps.js";
import type { Portal } from "../../sites/Portal.js";

/**
 * Standardized snapshot of target portals at a site.
 * Used for exporting/importing target portal records.
 */
export interface SiteTargetPortals {
    siteId: SiteId;
    /** The timestamp of the export action itself */
    exportedAt: number;
    /** Grouped target portal artifacts */
    artifact: ObservedTargetArtifact[];
}

export interface ObservedTargetArtifact extends Omit<TargetArtifact, "target"> {
    target?: ObservedTargetPortalCapture[];
}

export interface ObservedTargetPortalCapture {
    portalInfo: Portal;
    targetAlignment: "RESISTANCE" | "ENLIGHTENED";
    /** The timestamp of when the target state was observed */
    observedAt: number;
}

