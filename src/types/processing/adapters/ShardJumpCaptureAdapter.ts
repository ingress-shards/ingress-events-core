/* eslint-disable unicorn/no-array-sort */
import type { SiteId, PortalId } from "../../../common/Identifiers.js";
import type { SiteRecord } from "../../../sites/Site.js";
import type { ShardJumpCapture, Fragment, FragmentHistoryType, TargetArtifact } from "../../capture/ShardJumps.js";
import type { DataObservationAdapter } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { fromNianticId, type FactionId } from "../../../common/Factions.js";
import { EventConfigRegistry } from "../../../config/EventConfigRegistry.js";
import type { ShardHistoryEntry } from "../../../sites/Shard.js";

interface ReferencePortal {
    latE6: number;
    lngE6: number;
    title: string;
    guid?: string;
}

export class ShardJumpCaptureAdapter implements DataObservationAdapter<ShardJumpCapture> {
    private portalIdMapper = new PortalIdMapper();

    private parseFragment(
        fragment: Fragment,
        config: EventConfigRegistry,
        getOrCreateRecord: (siteId: SiteId, seasonId: string) => SiteRecord
    ): void {
        const sortedHistory = [...fragment.history].sort((a, b) => a.moveTimeMs.localeCompare(b.moveTimeMs));
        const spawnItem = sortedHistory.find(h => h.reason === "spawn");

        // Fall back to first history item if no explicit spawn
        const firstItem = spawnItem ?? sortedHistory[0];
        if (!firstItem) return;

        // Spawn portal coordinates
        let referencePortal: ReferencePortal | undefined;
        if ("destinationPortalInfo" in firstItem && firstItem.destinationPortalInfo) {
            referencePortal = firstItem.destinationPortalInfo;
        } else if ("originPortalInfo" in firstItem && firstItem.originPortalInfo) {
            referencePortal = firstItem.originPortalInfo;
        }

        if (!referencePortal) return;

        const firstTimeMs = Number(firstItem.moveTimeMs);
        const match = config.findSiteByCoords(referencePortal.latE6, referencePortal.lngE6, firstTimeMs);
        if (!match) return;

        const { siteId, seasonId } = match;
        const record = getOrCreateRecord(siteId, seasonId);
        const obs = record.observations!;

        // Extract shard details
        const shardIdNum = Number(
            fragment.id.includes("_") 
                ? fragment.id.slice(fragment.id.lastIndexOf("_") + 1) 
                : fragment.id
        );

        let lastPortalId: PortalId | undefined;

        const historyEntries: ShardHistoryEntry[] = sortedHistory
            .map((h: FragmentHistoryType) => {
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

                const mismatch = (h.reason === "link" || h.reason === "jump") && creatorFaction && destinationFaction && originFaction &&
                    (creatorFaction !== destinationFaction || creatorFaction !== originFaction || destinationFaction !== originFaction);

                if (mismatch) {
                    console.warn(`[Shard Observer: Shard Jump Adapter] Team mismatch for shard ${fragment.id} at ${h.moveTimeMs}: linkCreatorTeam="${creatorFaction}", destinationCapturerTeam="${destinationFaction}", originCapturerTeam="${originFaction}"`);
                }

                let team: FactionId | undefined;
                switch (h.reason) {
                    case "spawn": team = destinationFaction; break;
                    case "link": team = creatorFaction; break;
                    case "despawn": team = originFaction; break;
                }

                let linkTime: number | undefined;
                if ("linkCreationTimeMs" in h && h.linkCreationTimeMs) {
                    linkTime = Number(h.linkCreationTimeMs);
                }

                const isMovement = h.reason === "link" || h.reason === "jump";
                const destination = (isMovement && destinationPortalId) ? destinationPortalId : undefined;

                return {
                    action: h.reason,
                    moveTime: Number(h.moveTimeMs),
                    portalId,
                    ...(destination && { dest: destination }),
                    ...(team && { team }),
                    ...(linkTime && { linkTime }),
                    ...(mismatch && { mismatch: true }),
                };
            })
            .filter((entry): entry is ShardHistoryEntry => entry !== undefined);

        obs.shards ??= {};
        obs.shards[shardIdNum] = {
            history: historyEntries
        };
    }

    private parseTargetPortals(
        art: TargetArtifact,
        config: EventConfigRegistry,
        getOrCreateRecord: (siteId: SiteId, seasonId: string) => SiteRecord,
        timestampMs: number
    ): void {
        const ornId = art.id; // Target identifier
        if (ornId !== "targetres" && ornId !== "targetenl") {
            console.warn(`[ShardJumpCaptureAdapter] Invalid target ornament ID "${ornId}". Skipping.`);
            return;
        }
        const targets = art.target ?? [];
        for (const t of targets) {
            const info = t.portalInfo;
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

    public parseAndGroupObservations(input: ShardJumpCapture, config: EventConfigRegistry): SiteRecord[] {
        const timestampMs = input.timestamp;
        if (timestampMs === undefined) {
            throw new Error("[ShardJumpCaptureAdapter] Missing capture timestamp in ShardJumpCapture input");
        }
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

        const artifacts = input.artifact ?? [];
        for (const art of artifacts) {
            // 1. Handle fragments/shards
            if ("fragment" in art && art.fragment) {
                for (const fragment of art.fragment) {
                    this.parseFragment(fragment, config, getOrCreateRecord);
                }
            }

            // 2. Handle target portals
            if ("target" in art && art.target) {
                this.parseTargetPortals(art, config, getOrCreateRecord, timestampMs);
            }
        }

        const results: SiteRecord[] = [];
        // eslint-disable-next-line unicorn/prefer-spread
        for (const value of siteRecordsMap.values()) {
            results.push(value);
        }
        return results;
    }
}
