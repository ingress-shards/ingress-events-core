import type { SiteState, SiteTelemetry } from "../../sites/Site.js";
import type { ShardTelemetryEntry } from "../../sites/Shard.js";
import { instant } from "temporal-polyfill/fns/Now";
import type { PortalMergeStrategy } from "./PortalMergeStrategy.js";
import { DefaultPortalMergeStrategy } from "./DefaultPortalMergeStrategy.js";
import type { SiteConfig, ShardWaveTimeline } from "../../config/SiteConfig.js";

export class SiteStateMerger {
    /**
     * Merges incoming telemetry into an existing site state, performing deep merging
     * of portals and shards, allocating IDs, and maintaining strict chronological order.
     */
    public merge(
        existingState: SiteState,
        incomingTelemetry: SiteTelemetry,
        siteConfig?: SiteConfig
    ): { state: SiteState; hasChanged: boolean } {
        // 1. Deep clone the base state to ensure immutability
        const state = structuredClone(existingState);
        let hasChanged = false;

        state.telemetry ??= {};
        const telemetry: SiteTelemetry = state.telemetry;

        // Map to keep track of coordinate key -> final numeric portal ID mapping
        const coordToPortalIdMap = new Map<string, number>();

        // Pre-populate the map with existing portals in the site state
        if (telemetry.portals) {
            for (const [id, p] of Object.entries(telemetry.portals)) {
                coordToPortalIdMap.set(`${p.latE6}_${p.lngE6}`, Number(id));
            }
        }

        // Determine the next numeric portal ID to allocate
        const nextPortalId = 1 + Math.max(0, ...Object.keys(telemetry.portals ?? {}).map(Number));

        // 2. Merge Portals using strategy
        if (incomingTelemetry.portals && Object.keys(incomingTelemetry.portals).length > 0) {
            telemetry.portals ??= {};

            const strategy: PortalMergeStrategy = new DefaultPortalMergeStrategy();
            const waves = siteConfig?.timeline?.shards;

            const result = strategy.merge(telemetry.portals, incomingTelemetry.portals, {
                coordToPortalIdMap,
                nextPortalId,
                getWaveIndex: (timestamp: number) => {
                    if (!waves) return;
                    // Check if timestamp falls in [start, end + 59999] of any wave
                    const index = waves.findIndex((w: ShardWaveTimeline) => timestamp >= w.start && timestamp <= w.end + 59999);
                    return index === -1 ? undefined : index;
                }
            });

            telemetry.portals = result.portals;
            if (result.hasChanged) {
                hasChanged = true;
            }

            // Sync orchestrator's map with strategy's final coordinate mapping for shard ID resolution
            coordToPortalIdMap.clear();
            for (const [k, v] of result.coordToPortalIdMap) {
                coordToPortalIdMap.set(k, v);
            }
        }

        // Helper to resolve the id of the portal in the incoming data to the portal in the base site state
        const resolvePortalId = (incomingPortalId: number): number => {
            const incomingPortal = incomingTelemetry.portals?.[incomingPortalId];
            if (incomingPortal === undefined) {
                throw new Error(`Portal ${incomingPortalId} not found in incoming telemetry`);
            }

            const resolvedPortal = coordToPortalIdMap.get(`${incomingPortal.latE6}_${incomingPortal.lngE6}`);
            if (resolvedPortal === undefined) {
                throw new Error(`Portal ${incomingPortalId} not found in base site state`);
            }
            return resolvedPortal;
        };

        // 3. Merge Shards
        if (incomingTelemetry.shards && Object.keys(incomingTelemetry.shards).length > 0) {
            telemetry.shards ??= {};
            for (const [shardNumberKey, incomingShard] of Object.entries(incomingTelemetry.shards)) {
                const incomingShardNumber = Number(shardNumberKey);

                // Map the origin and destination entries to site state portal ids
                const mappedHistory: ShardTelemetryEntry[] = (incomingShard.history || []).map(h => ({
                    action: h.action,
                    moveTime: h.moveTime,
                    portalId: resolvePortalId(h.portalId),
                    ...(h.dest !== undefined && { dest: resolvePortalId(h.dest) }),
                    ...(h.align !== undefined && { align: h.align }),
                    ...(h.linkTime !== undefined && { linkTime: h.linkTime }),
                    ...(h.mismatch !== undefined && { mismatch: h.mismatch }),
                    ...(h.invalid !== undefined && { invalid: h.invalid })
                }));

                const existingShard = telemetry.shards[incomingShardNumber];
                if (existingShard === undefined) {
                    telemetry.shards[incomingShardNumber] = {
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
            state.metadata.lastUpdated = instant().epochMilliseconds;
        }
        return { state, hasChanged };
    }
}
