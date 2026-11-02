import type { SiteId } from "../../../common/Identifiers.js";
import type { SiteRecord } from "../../../sites/Site.js";
import type { MapSnapshot } from "../../capture/MapSnapshot.js";
import type { DataObservationAdapter, IngestionItem } from "../DataObservationAdapter.js";
import type { Ornament } from "../../config/EventBlueprints.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { PORTAL_HISTORY_TYPES } from "../../../sites/Portal.js";
import type { PortalHistoryType } from "../../../sites/Portal.js";
import { findSiteByCoords } from "../../../common/Geo.js";
import type { SiteConfig } from "../../../config/SiteConfig.js";
import { instant } from "temporal-polyfill/fns/Now";
import { parseTimestampFromFilename } from "../../../common/Date.js";

export class MapSnapshotAdapter implements DataObservationAdapter<MapSnapshot> {
    private readonly filenamePattern = /^map-snapshot.*\.json$/i;
    private portalIdMapper = new PortalIdMapper();

    constructor(
        private blueprintOrnaments: Record<string, Ornament>,
        private candidateSites: SiteConfig[]
    ) {}

    private parsePortalHistory(ornaments: string[], timestamp: number): any[] {
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
                    timestamp,
                    ornId: ornId
                });
            }
        }
        return historyEntries;
    }

    public tryParse(item: IngestionItem): MapSnapshot | undefined {
        if (!this.filenamePattern.test(item.filename)) return undefined;

        try {
            const mapSnapshot: Partial<MapSnapshot> =
                typeof item.data === "string" ? JSON.parse(item.data) : item.data;

            if (Array.isArray(mapSnapshot.portals)) {
                if (!mapSnapshot.timestamp) {
                    const timestamp = parseTimestampFromFilename(item.filename);
                    if (!timestamp) return undefined;
                    mapSnapshot.timestamp = timestamp;
                }
                return mapSnapshot as MapSnapshot;
            }
        } catch (error) {
            console.error(`[MapSnapshotAdapter] Failed to parse JSON from ${item.filename}:`, error);
        }
        return undefined;
    }

    public parseAndGroupObservations(input: MapSnapshot): SiteRecord[] {
        const timestamp = input.timestamp;
        if (timestamp === undefined) {
            throw new Error("[MapSnapshotAdapter] Missing snapshot timestamp in MapSnapshot input");
        }
        const siteRecordsMap = new Map<SiteId, SiteRecord>();
        const ignoredSites = new Set<SiteId>();

        const portalsInput = input.portals ?? [];
        for (const p of portalsInput) {
            const matchedSite = findSiteByCoords(this.candidateSites, p.latE6, p.lngE6, timestamp);
            if (!matchedSite) continue;

            const siteId = matchedSite.geocode.id;
            if (ignoredSites.has(siteId)) continue;

            const seasonId = matchedSite.seasonId;

            const cutoff = matchedSite.timeline?.preEventCutoff;
            if (cutoff !== undefined && timestamp > cutoff) {
                ignoredSites.add(siteId);
                continue;
            }

            let record = siteRecordsMap.get(siteId);
            if (!record) {
                record = {
                    metadata: {
                        siteId,
                        seasonId,
                        lastUpdated: instant().epochMilliseconds,
                    },
                    observations: { portals: {}, shards: {} },
                };
                siteRecordsMap.set(siteId, record);
            }

            const portals = record.observations!.portals!;
            const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, p.latE6, p.lngE6);

            const historyEntries = p.ornaments ? this.parsePortalHistory(p.ornaments, timestamp) : [];

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
