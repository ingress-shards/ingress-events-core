import type { SiteId } from "../../../common/Identifiers.js";
import type { SiteRecord } from "../../../sites/Site.js";
import type { MapSnapshot } from "../../capture/MapSnapshot.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import type { Ornament } from "../../config/EventBlueprints.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { PORTAL_HISTORY_TYPES } from "../../../sites/Portal.js";
import type { PortalHistoryType } from "../../../sites/Portal.js";
import * as Now from "temporal-polyfill/fns/Now";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";

export class MapSnapshotAdapter implements DataObservationAdapter<MapSnapshot> {
    private portalIdMapper = new PortalIdMapper();

    constructor(
        private blueprintOrnaments: Record<string, Ornament>,
        private timestampMs: number = Now.instant().epochMilliseconds
    ) {}

    private parsePortalHistory(ornaments: string[]): any[] {
        const historyEntries: any[] = [];
        for (const ornId of ornaments) {
            const blueprint = this.blueprintOrnaments[ornId];
            if (!blueprint) {
                console.warn(`[MapSnapshotAdapter] Ornament "${ornId}" not found in blueprints. Skipping.`);
                continue;
            }

            // A blueprint ornament can have multiple tags, we use the first tag that is a valid history type
            const historyType = blueprint.tags.find((tag): tag is PortalHistoryType => 
                (PORTAL_HISTORY_TYPES as readonly string[]).includes(tag)
            );
            if (historyType) {
                historyEntries.push({
                    type: historyType,
                    timestamp: this.timestampMs,
                    ornId: ornId
                });
            }
        }
        return historyEntries;
    }

    public parseAndGroupObservations(input: MapSnapshot, config: EventConfigRegistry): SiteRecord[] {
        const timestampMs = input.timestamp;
        if (timestampMs === undefined) {
            throw new Error("[MapSnapshotAdapter] Missing snapshot timestamp in MapSnapshot input");
        }
        const siteRecordsMap = new Map<SiteId, SiteRecord>();
        const ignoredSites = new Set<SiteId>();

        const portalsInput = input.portals ?? [];
        for (const p of portalsInput) {
            const match = config.findSiteByCoords(p.latE6, p.lngE6, timestampMs);
            if (!match) continue;

            const { siteId, seasonId } = match;
            if (ignoredSites.has(siteId)) continue;

            const siteConfig = config.getSiteConfig(siteId);
            const cutoff = siteConfig?.timeline?.preEventCutoff;
            if (cutoff !== undefined && timestampMs > cutoff) {
                ignoredSites.add(siteId);
                continue;
            }

            let record = siteRecordsMap.get(siteId);
            if (!record) {
                record = {
                    metadata: {
                        siteId,
                        seasonId,
                        lastUpdated: 0,
                    },
                    observations: { portals: {}, shards: {} },
                };
                siteRecordsMap.set(siteId, record);
            }

            const portals = record.observations!.portals!;
            const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, p.latE6, p.lngE6);

            const historyEntries = p.ornaments ? this.parsePortalHistory(p.ornaments) : [];

            // If we found any valid ornament history entries, or if it's an identifiable portal we want to track
            if (historyEntries.length > 0) {
                portals[portalId] = {
                    ...p,
                    history: historyEntries
                };
            }
        }

        // eslint-disable-next-line unicorn/prefer-spread
        return Array.from(siteRecordsMap.values());
    }
}
