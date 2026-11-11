import type { SiteId } from "../../common/Identifiers.js";
import type { SiteTelemetry } from "../../sites/Site.js";

/**
 * Standard utility to find or create a site telemetry bucket within a grouped Map.
 */
export const getOrCreateSiteBucket = (
    grouped: Map<SiteId, SiteTelemetry>,
    siteId: SiteId
): SiteTelemetry => {
    let bucket = grouped.get(siteId);
    if (!bucket) {
        bucket = {};
        grouped.set(siteId, bucket);
    }
    return bucket;
};

/**
 * Standard utility to map geographic coordinate strings to sequential numeric portal IDs per-site.
 */
export class PortalIdMapper {
    private sitePortalMaps = new Map<SiteId, Map<string, number>>();

    /**
     * Retrieves or allocates a sequential numeric PortalId for a given coordinate set under a specific site.
     */
    public getOrCreatePortalId(siteId: SiteId, latE6: number, lngE6: number): number {
        let portalMap = this.sitePortalMaps.get(siteId);
        if (!portalMap) {
            portalMap = new Map<string, number>();
            this.sitePortalMaps.set(siteId, portalMap);
        }
        const key = `${latE6}_${lngE6}`;
        let id = portalMap.get(key);
        if (id === undefined) {
            id = portalMap.size + 1;
            portalMap.set(key, id);
        }
        return id;
    }
}
