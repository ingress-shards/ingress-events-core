/* eslint-disable unicorn/no-array-sort */
import type { SiteRecord, SiteObservation } from "../Site.js";
import type { ShardHistoryEntry } from "../Shard.js";
import { instant } from "temporal-polyfill/fns/Now";
import type { PortalMergeStrategy } from "./PortalMergeStrategy.js";
import { DefaultPortalMergeStrategy } from "./DefaultPortalMergeStrategy.js";
import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";
import type { WaveTimeline } from "../../seasons/SeasonConfig.js";

export class SiteRecordMerger {
    /**
     * Merges incoming observations into an existing site record, performing deep merging
     * of portals and shards, allocating IDs, and maintaining strict chronological order.
     */
    public merge(
        baseRecord: SiteRecord,
        incomingObs: SiteObservation,
        config?: EventConfigRegistry
    ): { record: SiteRecord; hasChanged: boolean } {
        // 1. Deep clone the base record to ensure immutability
        const record = structuredClone(baseRecord);
        let hasChanged = false;

        record.observations ??= {};
        const observations: SiteObservation = record.observations;

        // Map to keep track of coordinate key -> final numeric portal ID mapping
        const coordToPortalIdMap = new Map<string, number>();

        // Pre-populate the map with existing portals in the site record
        if (observations.portals) {
            for (const [id, p] of Object.entries(observations.portals)) {
                coordToPortalIdMap.set(`${p.latE6}_${p.lngE6}`, Number(id));
            }
        }

        // Determine the next numeric portal ID to allocate
        const nextPortalId = 1 + Math.max(0, ...Object.keys(observations.portals ?? {}).map(Number));

        // 2. Merge Portals using strategy
        if (incomingObs.portals && Object.keys(incomingObs.portals).length > 0) {
            observations.portals ??= {};

            const strategy: PortalMergeStrategy = new DefaultPortalMergeStrategy();
            const siteConfig = config?.getSiteConfig(record.metadata.siteId);
            const waves = siteConfig?.timeline?.shards;

            const result = strategy.merge(observations.portals, incomingObs.portals, {
                coordToPortalIdMap,
                nextPortalId,
                getWaveIndex: (timestamp: number) => {
                    if (!waves) return;
                    // Check if timestamp falls in [start, end + 59999] of any wave
                    const index = waves.findIndex((w: WaveTimeline) => timestamp >= w.start && timestamp <= w.end + 59999);
                    return index === -1 ? undefined : index;
                }
            });

            observations.portals = result.portals;
            if (result.hasChanged) {
                hasChanged = true;
            }

            // Sync orchestrator's map with strategy's final coordinate mapping for shard ID resolution
            coordToPortalIdMap.clear();
            for (const [k, v] of result.coordToPortalIdMap.entries()) {
                coordToPortalIdMap.set(k, v);
            }
        }

        // Helper to resolve the id of the portal in the incoming data to the portal in the based site record
        const resolvePortalId = (incomingPortalId: number): number => {
            const incomingPortal = incomingObs.portals?.[incomingPortalId];
            if (incomingPortal === undefined) {
                throw new Error(`Portal ${incomingPortalId} not found in incoming observation`);
            }

            const resolvedPortal = coordToPortalIdMap.get(`${incomingPortal.latE6}_${incomingPortal.lngE6}`);
            if (resolvedPortal === undefined) {
                throw new Error(`Portal ${incomingPortalId} not found in base site record`);
            }
            return resolvedPortal;
        };

        // 3. Merge Shards
        if (incomingObs.shards && Object.keys(incomingObs.shards).length > 0) {
            observations.shards ??= {};
            for (const [shardNumberKey, incomingShard] of Object.entries(incomingObs.shards)) {
                const incomingShardNumber = Number(shardNumberKey);

                // Map the origin and destination entries to site record portal ids
                const mappedHistory = (incomingShard.history || []).map(h => ({
                    action: h.action,
                    moveTime: h.moveTime,
                    portalId: resolvePortalId(h.portalId),
                    dest: h.dest ? resolvePortalId(h.dest) : undefined,
                    team: h.team,
                    ...(h.linkTime !== undefined && { linkTime: h.linkTime }),
                    ...(h.mismatch !== undefined && { mismatch: h.mismatch })
                }) as ShardHistoryEntry);

                const existingShard = observations.shards[incomingShardNumber];
                if (existingShard === undefined) {
                    observations.shards[incomingShardNumber] = {
                        history: [...mappedHistory].sort((a, b) => a.moveTime - b.moveTime)
                    };
                    hasChanged = true;
                } else {
                    // Shard already exists, merge history
                    for (const incomingHist of mappedHistory) {
                        const isDuplicate = existingShard.history.some(h =>
                            h.action === incomingHist.action &&
                            h.moveTime === incomingHist.moveTime &&
                            h.portalId === incomingHist.portalId &&
                            h.dest === incomingHist.dest
                        );

                        if (!isDuplicate) {
                            existingShard.history.push(incomingHist);
                            hasChanged = true;
                        }
                    }

                    existingShard.history = [...existingShard.history].sort((a, b) => a.moveTime - b.moveTime);
                }
            }
        }

        if (hasChanged) {
            record.metadata.lastUpdated = instant().epochMilliseconds;
        }
        return { record, hasChanged };
    }
}
