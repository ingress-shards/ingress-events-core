/* eslint-disable unicorn/no-array-sort */
import type { SiteId, PortalId } from "../../../common/Identifiers.js";
import type { SiteRecord } from "../../../sites/Site.js";
import type { ShardJumpCapture, FragmentArtifact } from "../../capture/ShardJumps.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import * as Now from "temporal-polyfill/fns/now";
import * as Instant from "temporal-polyfill/fns/instant";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { fromNianticId } from "../../../common/Factions.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";

interface ReferencePortal {
    latE6: number;
    lngE6: number;
    title: string;
    guid?: string;
}

export class ShardJumpCaptureAdapter implements DataObservationAdapter<ShardJumpCapture> {
    private portalIdMapper = new PortalIdMapper();

    public parseAndGroupObservations(input: ShardJumpCapture, config: EventConfigRegistry): SiteRecord[] {
        const siteRecordsMap = new Map<SiteId, SiteRecord>();

        const getOrCreateRecord = (siteId: SiteId, seasonId: string): SiteRecord => {
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
            return record;
        };

        for (const art of input.artifact ?? []) {
            // 1. Handle fragments/shards
            if ("fragment" in art && art.fragment) {
                for (const fragment of art.fragment) {
                    const sortedHistory = [...fragment.history].sort((a, b) => a.moveTimeMs.localeCompare(b.moveTimeMs));
                    const spawnItem = sortedHistory.find(h => h.reason === "spawn");

                    // Fall back to first history item if no explicit spawn
                    const firstItem = spawnItem ?? sortedHistory[0];
                    if (!firstItem) continue;

                    // Spawn portal coordinates
                    let referencePortal: ReferencePortal | undefined;
                    if ("destinationPortalInfo" in firstItem && firstItem.destinationPortalInfo) {
                        referencePortal = firstItem.destinationPortalInfo;
                    } else if ("originPortalInfo" in firstItem && firstItem.originPortalInfo) {
                        referencePortal = firstItem.originPortalInfo;
                    }

                    if (!referencePortal) continue;

                    const firstTimeMs = parseInt(firstItem.moveTimeMs, 10);
                    const match = config.findSiteByCoords(referencePortal.latE6, referencePortal.lngE6, firstTimeMs);
                    if (!match) continue;

                    const { siteId, seasonId } = match;
                    const record = getOrCreateRecord(siteId, seasonId);
                    const obs = record.observations!;

                    // Extract shard details
                    const shardIdNum = parseInt(
                        fragment.id.includes("_") 
                            ? fragment.id.slice(fragment.id.lastIndexOf("_") + 1) 
                            : fragment.id, 
                        10
                    );

                    let lastPortalId: PortalId | undefined;

                    const historyEntries = sortedHistory
                        .map(h => {
                            const originPortal = "originPortalInfo" in h ? h.originPortalInfo : undefined;
                            const destinationPortal = "destinationPortalInfo" in h ? h.destinationPortalInfo : undefined;

                            // For link/jump actions, originPortalInfo is where it started.
                            // For spawn/despawn/no move, originPortalInfo might be missing, so we check destinationPortal.
                            const portal = originPortal ?? destinationPortal;

                            let portalId: PortalId | undefined;
                            if (portal) {
                                portalId = this.portalIdMapper.getOrCreatePortalId(siteId, portal.latE6, portal.lngE6);

                                // Add portals seen in history to our site's portals record (WHITE-LISTING)
                                obs.portals ??= {};
                                obs.portals[portalId] = {
                                    title: portal.title,
                                    latE6: portal.latE6,
                                    lngE6: portal.lngE6,
                                };
                            } else {
                                portalId = lastPortalId;
                            }

                            if (!portalId) {
                                console.warn(`[ShardJumpCaptureAdapter] No portal info found and no last-known location for shard ${fragment.id} at ${h.moveTimeMs} (reason: ${h.reason}). Skipping entry.`, h);
                                return;
                            }

                            const destinationPortalId = destinationPortal ? this.portalIdMapper.getOrCreatePortalId(siteId, destinationPortal.latE6, destinationPortal.lngE6) : undefined;
                            if (destinationPortal && destinationPortalId) {
                                // Add destination portal to site's portals record (WHITE-LISTING)
                                obs.portals ??= {};
                                obs.portals[destinationPortalId] = {
                                    title: destinationPortal.title,
                                    latE6: destinationPortal.latE6,
                                    lngE6: destinationPortal.lngE6,
                                };
                            }

                            // Update last portal ID based on destination or origin (in that order)
                            const restingPortal = destinationPortal ?? originPortal;
                            if (restingPortal) {
                                lastPortalId = this.portalIdMapper.getOrCreatePortalId(siteId, restingPortal.latE6, restingPortal.lngE6);
                            }

                            // Determine the team/faction code exclusively from linkCreatorTeam
                            const linkCreatorTeam = "linkCreatorTeam" in h ? h.linkCreatorTeam : undefined;
                            const destinationCapturerTeam = "destinationCapturerTeam" in h ? h.destinationCapturerTeam : undefined;
                            const originCapturerTeam = "originCapturerTeam" in h ? h.originCapturerTeam : undefined;

                            const creatorFaction = linkCreatorTeam ? fromNianticId(linkCreatorTeam) : undefined;
                            const destinationFaction = destinationCapturerTeam ? fromNianticId(destinationCapturerTeam) : undefined;
                            const originFaction = originCapturerTeam ? fromNianticId(originCapturerTeam) : undefined;

                            if (creatorFaction && destinationFaction && originFaction &&
                                (creatorFaction !== destinationFaction || creatorFaction !== originFaction || destinationFaction !== originFaction)) {
                                console.warn(`[ShardJumpCaptureAdapter] Team mismatch for shard ${fragment.id} at ${h.moveTimeMs}: linkCreatorTeam="${creatorFaction}", destinationCapturerTeam="${destinationFaction}", originCapturerTeam="${originFaction}"`);
                            }

                            // No move entries do not need to include the team code
                            const team = (creatorFaction && h.reason !== "no move") ? creatorFaction : undefined;

                            let linkTime: number | undefined;
                            if ("linkCreationTimeMs" in h && h.linkCreationTimeMs) {
                                linkTime = parseInt(h.linkCreationTimeMs, 10);
                            }

                            const isMovement = h.reason === "link" || h.reason === "jump";
                            const destination = (isMovement && destinationPortalId) ? destinationPortalId : undefined;

                            return {
                                action: h.reason as any,
                                moveTime: parseInt(h.moveTimeMs, 10),
                                portalId,
                                ...(destination && { dest: destination }),
                                ...(team && { team }),
                                ...(linkTime && { linkTime }),
                            };
                        })
                        .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

                    obs.shards ??= {};
                    obs.shards[shardIdNum] = {
                        history: historyEntries
                    };
                }
            }

            // 2. Handle target portals
            if ("target" in art && art.target) {
                const ornId = art.id; // Target identifier
                if (ornId !== "targetres" && ornId !== "targetenl") {
                    console.warn(`[ShardJumpCaptureAdapter] Invalid target ornament ID "${ornId}". Skipping.`);
                    continue;
                }
                for (const t of art.target) {
                    const info = t.portalInfo;
                    
                    let timestampMs = Instant.epochMilliseconds(Now.instant());
                    const firstFragment = input.artifact?.find((a): a is FragmentArtifact => "fragment" in a && !!a.fragment);
                    const firstHistory = firstFragment?.fragment?.[0]?.history?.[0];
                    if (firstHistory) {
                        timestampMs = parseInt(firstHistory.moveTimeMs, 10);
                    }

                    const match = config.findSiteByCoords(info.latE6, info.lngE6, timestampMs);
                    if (!match) continue;

                    const { siteId, seasonId } = match;
                    const record = getOrCreateRecord(siteId, seasonId);
                    const obs = record.observations!;
                    const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, info.latE6, info.lngE6);

                    obs.portals ??= {};
                    obs.portals[portalId] = {
                        ...info,
                        history: [
                            {
                                timestamp: timestampMs,
                                type: "target",
                                ornId
                            }
                        ]
                    };
                }
            }
        }

        return [...siteRecordsMap.values()];
    }
}
