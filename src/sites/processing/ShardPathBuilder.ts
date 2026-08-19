import type { Shard, ShardHistoryEntry, ShardPath, Link, ShardMove } from "../Shard.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ObservedPortal } from "../Portal.js";
import { haversineDistance } from "../../common/Geo.js";
import { roundToDecimalPlaces } from "../../common/Math.js";

const addShardPathEntries = (
    shardId: number,
    filteredHistory: ShardHistoryEntry[],
    portals: Record<PortalId, ObservedPortal> | undefined,
    paths: Record<string, ShardPath>
): void => {
    for (const h of filteredHistory) {
        if (h.action !== "link") {
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
            links: [],
            distance
        };

        const linkTime = h.linkTime ?? h.moveTime;
        const team = h.team ?? "NEU";

        let existingLink = paths[pathKey].links.find(l => l.linkTime === linkTime && l.team === team);
        if (!existingLink) {
            existingLink = {
                linkTime,
                team,
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
                ...(h.mismatch && { mismatch: true })
            });
        }
    }
};

export const ShardPathBuilder = {
    buildShardPaths: (
        shardEntries: [string, Shard][],
        portals: Record<PortalId, ObservedPortal> | undefined,
        linkScorer?: (move: ShardMove, link: Link, path: ShardPath) => string[]
    ): Record<string, ShardPath> => {
        const paths: Record<string, ShardPath> = {};

        for (const [shardIdStr, shard] of shardEntries) {
            const shardId = Number(shardIdStr);
            const history = shard.history || [];

            addShardPathEntries(shardId, history, portals, paths);
        }

        for (const path of Object.values(paths)) {
            path.links.sort((a, b) => a.linkTime - b.linkTime);
            for (const link of path.links) {
                link.moves.sort((a, b) => a.moveTime - b.moveTime);
            }
        }

        if (linkScorer) {
            const allMoves: { move: ShardMove; link: Link; path: ShardPath }[] = [];
            for (const path of Object.values(paths)) {
                for (const link of path.links) {
                    for (const move of link.moves) {
                        allMoves.push({ move, link, path });
                    }
                }
            }
            // Sort all moves chronologically across all shards for accurate state-locked evaluation
            allMoves.sort((a, b) => a.move.moveTime - b.move.moveTime);
            for (const { move, link, path } of allMoves) {
                move.scoredRules = linkScorer(move, link, path);
            }
        }

        return paths;
    },

    countLinkAlignmentMismatches: (
        pathsRecord: Record<string, ShardPath>,
        shouldIncludeMove?: (moveTime: number) => boolean
    ): number => {
        return Object.values(pathsRecord)
            .flatMap(path => path.links)
            .filter(link => {
                const mismatchedScoredMoves = link.moves.filter(move => {
                    const isInTimeWindow = shouldIncludeMove ? shouldIncludeMove(move.moveTime) : true;
                    return move.mismatch === true && isInTimeWindow && move.scoredRules && move.scoredRules.length > 0;
                });
                return mismatchedScoredMoves.length > 0;
            }).length;
    }
};
