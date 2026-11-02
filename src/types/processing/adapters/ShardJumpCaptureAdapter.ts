import type { SiteId, PortalId } from "../../../common/Identifiers.js";
import type { SiteRecord } from "../../../sites/Site.js";
import type { ShardJumpCapture, Fragment, FragmentHistoryType, TargetArtifact } from "../../capture/ShardJumps.js";
import type { DataObservationAdapter, IngestionItem } from "../DataObservationAdapter.js";
import { PortalIdMapper } from "../AdapterHelpers.js";
import { fromNianticId, type Alignment } from "../../../common/Alignment.js";
import { findSiteByCoords } from "../../../common/Geo.js";
import type { ShardHistoryEntry, ShardMismatch } from "../../../sites/Shard.js";
import type { SiteConfig } from "../../../config/SiteConfig.js";
import { instant } from "temporal-polyfill/fns/Now";
import { parseTimestampFromFilename } from "../../../common/Date.js";

interface ReferencePortal {
    latE6: number;
    lngE6: number;
    title: string;
    guid?: string;
}

export class ShardJumpCaptureAdapter implements DataObservationAdapter<ShardJumpCapture> {
    private readonly filenamePattern = /^shard-jump-times.*\.json$/i;
    private portalIdMapper = new PortalIdMapper();

    constructor(private readonly candidateSites: SiteConfig[]) {}

    private parseFragment(
        fragment: Fragment,
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

        const firstMoveTime = Number(firstItem.moveTimeMs);
        const matchedSite = findSiteByCoords(this.candidateSites, referencePortal.latE6, referencePortal.lngE6, firstMoveTime);
        if (!matchedSite) return;

        const siteId = matchedSite.geocode.id;
        const seasonId = matchedSite.seasonId;
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

                // Determine the alignment code exclusively from linkCreatorTeam
                const originAlignStr = ("originPortalInfo" in h && h.originPortalInfo?.team) ?? ("originCapturerTeam" in h && h.originCapturerTeam) ?? undefined;
                const destinationAlignStr = ("destinationPortalInfo" in h && h.destinationPortalInfo?.team) ?? ("destinationCapturerTeam" in h && h.destinationCapturerTeam) ?? undefined;
                const creatorAlignStr = ("linkCreatorTeam" in h && h.linkCreatorTeam) ?? undefined;

                const creatorAlign = creatorAlignStr ? fromNianticId(creatorAlignStr) : undefined;
                const destinationAlign = destinationAlignStr ? fromNianticId(destinationAlignStr) : undefined;
                const originAlign = originAlignStr ? fromNianticId(originAlignStr) : undefined;

                const isOriginMismatch = originAlign !== undefined && creatorAlign !== undefined && creatorAlign !== originAlign;
                const isDestinationMismatch = destinationAlign !== undefined && creatorAlign !== undefined && creatorAlign !== destinationAlign;
                const hasMismatch = h.reason === "link" && (isOriginMismatch || isDestinationMismatch);

                if (hasMismatch) {
                    console.warn(`[Shard Observer: Shard Jump Adapter] Alignment mismatch for shard ${fragment.id} at ${h.moveTimeMs}: linkCreator="${creatorAlign}", destination="${destinationAlign}", origin="${originAlign}"`);
                }

                const mismatch: ShardMismatch | undefined = hasMismatch
                    ? {
                        ...(originAlign && { originAlign }),
                        ...(destinationAlign && { destAlign: destinationAlign })
                    }
                    : undefined;

                let align: Alignment | undefined;
                switch (h.reason) {
                    case "spawn": align = destinationAlign; break;
                    case "link": align = creatorAlign; break;
                    case "despawn": align = originAlign; break;
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
                    ...(align && { align }),
                    ...(linkTime && { linkTime }),
                    ...(mismatch && { mismatch }),
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
        getOrCreateRecord: (siteId: SiteId, seasonId: string) => SiteRecord,
        timestamp: number
    ): void {
        const ornId = art.id; // Target identifier
        if (ornId !== "targetres" && ornId !== "targetenl") {
            console.warn(`[ShardJumpCaptureAdapter] Invalid target ornament ID "${ornId}". Skipping.`);
            return;
        }
        const targets = art.target ?? [];
        for (const t of targets) {
            const info = t.portalInfo;
            const matchedSite = findSiteByCoords(this.candidateSites, info.latE6, info.lngE6, timestamp);
            if (!matchedSite) continue;

            const siteId = matchedSite.geocode.id;
            const seasonId = matchedSite.seasonId;
            const record = getOrCreateRecord(siteId, seasonId);
            const obs = record.observations!;
            const portalId = this.portalIdMapper.getOrCreatePortalId(siteId, info.latE6, info.lngE6);

            obs.portals ??= {};
            obs.portals[portalId] = {
                ...info,
                history: [
                    {
                        timestamp,
                        type: "target",
                        ornId
                    }
                ]
            };
        }
    }

    public tryParse(item: IngestionItem): ShardJumpCapture | undefined {
        if (!this.filenamePattern.test(item.filename)) return undefined;
        
        try {
            const shardJumpCapture: Partial<ShardJumpCapture> =
                typeof item.data === "string" ? JSON.parse(item.data) : item.data;

            if (Array.isArray(shardJumpCapture.artifact)) {
                if (!shardJumpCapture.timestamp) {
                    const timestamp = parseTimestampFromFilename(item.filename);
                    if (!timestamp) return undefined;
                    shardJumpCapture.timestamp = timestamp;
                }
                return shardJumpCapture as ShardJumpCapture;
            }
        } catch (error) {
            console.error(`[ShardJumpCaptureAdapter] Failed to parse JSON from ${item.filename}:`, error);
        }
        return undefined;
    }

    public parseAndGroupObservations(input: ShardJumpCapture): SiteRecord[] {
        if (input.timestamp === undefined) {
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
                        lastUpdated: instant().epochMilliseconds,
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
                    this.parseFragment(fragment, getOrCreateRecord);
                }
            }

            // 2. Handle target portals
            if ("target" in art && art.target) {
                this.parseTargetPortals(art, getOrCreateRecord, input.timestamp);
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
