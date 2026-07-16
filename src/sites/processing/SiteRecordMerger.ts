/* eslint-disable unicorn/no-array-sort */
import type { SiteRecord, SiteObservation } from "../Site.js";
import type { ShardHistoryEntry } from "../Shard.js";
import { instant } from "temporal-polyfill/fns/now";
import { epochMilliseconds } from "temporal-polyfill/fns/instant";
import type { PortalMergeStrategy } from "./PortalMergeStrategy.js";
import { DefaultPortalMergeStrategy } from "./DefaultPortalMergeStrategy.js";

export class SiteRecordMerger {
    /**
     * Merges incoming observations into an existing site record, performing deep merging
     * of portals and shards, allocating IDs, and maintaining strict chronological order.
     */
    public merge(baseRecord: SiteRecord, incomingObs: SiteObservation): { record: SiteRecord; hasChanged: boolean } {
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

            const result = strategy.merge(observations.portals, incomingObs.portals, {
                coordToPortalIdMap,
                nextPortalId
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

        // Map to keep track of shard number -> final numeric database shard ID mapping
        const shardNumberToIdMap = new Map<number, number>();

        // Pre-populate the map with existing shards in the site record
        if (observations.shards) {
            for (const [id, s] of Object.entries(observations.shards)) {
                shardNumberToIdMap.set(s.shardNumber, Number(id));
            }
        }

        // Determine the next numeric database shard ID to allocate
        let nextShardId = 1 + Math.max(0, ...Object.keys(observations.shards ?? {}).map(Number));

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
                    ...(h.linkTime !== undefined && { linkTime: h.linkTime })
                }) as ShardHistoryEntry);

                let shardId = shardNumberToIdMap.get(incomingShardNumber);
                if (shardId === undefined) {
                    // New shard at this site, assign new sequential database ID
                    shardId = nextShardId++;
                    shardNumberToIdMap.set(incomingShardNumber, shardId);

                    observations.shards[shardId] = {
                        shardNumber: incomingShardNumber,
                        history: [...mappedHistory].sort((a, b) => a.moveTime - b.moveTime)
                    };
                    hasChanged = true;
                } else {
                    // Shard already exists, merge history
                    const existingShard = observations.shards[shardId];
                    if (!existingShard) {
                        console.log("Existing shard not found", shardId);
                        continue;
                    }

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
            record.metadata.lastUpdated = epochMilliseconds(instant());
        }
        return { record, hasChanged };
    }
}
