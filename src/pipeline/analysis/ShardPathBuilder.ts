import type { Shard, ShardTelemetryEntry, ShardPath } from "../../sites/Shard.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import { haversineDistance } from "../../common/Geo.js";
import { roundToDecimalPlaces } from "../../common/Math.js";

export class ShardPathBuilder {
    private addShardPathEntries(
        shardId: number,
        filteredHistory: ShardTelemetryEntry[],
        portals: Record<PortalId, ObservedPortal> | undefined,
        paths: Record<string, ShardPath>
    ): void {
        for (const h of filteredHistory) {
            if (h.action !== "link" && h.action !== "jump") {
                continue;
            }

            const origin = h.portalId;
            const destination = h.dest;
            if (destination === undefined) {
                continue;
            }

            const p1 = Math.min(origin, destination);
            const p2 = Math.max(origin, destination);
            const pathKey = `${p1}-${p2}`;

            let distance = 0;
            const portal1 = portals?.[p1];
            const portal2 = portals?.[p2];
            if (portal1 && portal2) {
                distance = roundToDecimalPlaces(haversineDistance(portal1, portal2), 2);
            }

            paths[pathKey] ??= {
                distance,
                links: []
            };

            if (h.action === "jump") {
                paths[pathKey].teleports ??= [];
                const isTeleportExists = paths[pathKey].teleports.some(m => m.shardId === shardId && m.moveTime === h.moveTime);
                if (!isTeleportExists) {
                    paths[pathKey].teleports.push({
                        origin,
                        dest: destination,
                        shardId,
                        moveTime: h.moveTime,
                    });
                }
                continue;
            }

            const linkTime = h.linkTime ?? h.moveTime;
            const align = h.align ?? "NEU";

            let existingLink = paths[pathKey].links.find(l => l.linkTime === linkTime && l.align === align);
            if (!existingLink) {
                existingLink = {
                    linkTime,
                    align,
                    moves: []
                };
                paths[pathKey].links.push(existingLink);
            }

            const isMoveExists = existingLink.moves.some(m => m.shardId === shardId && m.moveTime === h.moveTime);
            if (!isMoveExists) {
                existingLink.moves.push({
                    origin,
                    dest: destination,
                    shardId,
                    moveTime: h.moveTime,

                });
            }
        }
    }

    public build(
        shards: Map<number, Shard>,
        portals?: Record<PortalId, ObservedPortal>
    ): Record<string, ShardPath> {
        const paths: Record<string, ShardPath> = {};

        for (const [shardId, shard] of shards) {
            const history = shard.history || [];
            this.addShardPathEntries(shardId, history, portals, paths);
        }

        for (const path of Object.values(paths)) {
            path.links.sort((a, b) => a.linkTime - b.linkTime);
            for (const link of path.links) {
                link.moves.sort((a, b) => a.moveTime - b.moveTime);
            }
            if (path.teleports) {
                path.teleports.sort((a, b) => a.moveTime - b.moveTime);
            }
        }

        return paths;
    }
}
