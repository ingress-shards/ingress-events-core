import type { Shard, ShardHistoryEntry, ShardPath } from "../Shard.js";
import type { ShardJumpWindow, FactionPointsBreakdown } from "../Site.js";
import type { ObservedPortal } from "../Portal.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { FactionId } from "../../common/Factions.js";
import type { ShardGoalScoringRule, ShardLinkScoringRule } from "../../types/index.js";
import type { EventTimeline, ScheduledShardAction } from "../../seasons/SeasonConfig.js";
import { roundToDecimalPlaces } from "../../common/Math.js";
import { GoalScoringEngine } from "./GoalScoringEngine.js";
import { isMovementInWindow, type JumpWindowBounds } from "./JumpWindowUtilities.js";

interface WindowHistoryResult {
    jumpHistory: ShardHistoryEntry[];
    jumpMismatchedLinks: Map<string, FactionId>;
}

/**
 * Gathers all shard movements in the jump window and detects alignment mismatches on scored links.
 */
const collectWindowHistory = (
    shards: Map<number, Shard>,
    siteShardPaths: Record<string, ShardPath>,
    windowBounds: JumpWindowBounds
): WindowHistoryResult => {
    const jumpHistory: ShardHistoryEntry[] = [];
    const jumpMismatchedLinks = new Map<string, FactionId>();

    for (const [sId, s] of shards) {
        if (!s?.history) continue;
        const matchingEntries = s.history.filter(h => isMovementInWindow(h, windowBounds));
        for (const h of matchingEntries) {
            jumpHistory.push(h);
            if (h.mismatch && h.team && (h.team === "RES" || h.team === "ENL") && h.dest !== undefined) {
                const p1 = Math.min(h.portalId, h.dest);
                const p2 = Math.max(h.portalId, h.dest);
                const pathKey = `${p1}-${p2}`;
                const path = siteShardPaths[pathKey];
                if (path) {
                    const matchingMove = path.links
                        .flatMap(link => link.moves)
                        .find(m => m.shardId === sId && m.moveTime === h.moveTime);

                    if (matchingMove?.scoredRules && matchingMove.scoredRules.length > 0) {
                        jumpMismatchedLinks.set(pathKey, h.team);
                    }
                }
            }
        }
    }

    return { jumpHistory, jumpMismatchedLinks };
};

interface LinkScoringResult {
    linkPoints: Record<FactionId, number>;
    linksBreakdown: Partial<Record<FactionId, Record<string, number>>>;
}

const processLinkMoves = (
    link: ShardPath["links"][number],
    attributionTeam: "RES" | "ENL",
    windowBounds: JumpWindowBounds,
    linkRules: Record<string, ShardLinkScoringRule>,
    linkPoints: Record<FactionId, number>,
    linksBreakdown: Partial<Record<FactionId, Record<string, number>>>
) => {
    for (const move of link.moves) {
        if (!isMovementInWindow({ action: "link", moveTime: move.moveTime }, windowBounds) || !move.scoredRules || move.scoredRules.length === 0) {
            continue;
        }

        const teamBreakdown = linksBreakdown[attributionTeam] ??= {};
        for (const ruleId of move.scoredRules) {
            teamBreakdown[ruleId] = (teamBreakdown[ruleId] ?? 0) + 1;
            const points = linkRules[ruleId]?.points ?? 0;
            linkPoints[attributionTeam] = (linkPoints[attributionTeam] ?? 0) + points;
        }
    }
};

/**
 * Calculates faction points and breakdown for shard link moves occurring within the jump window.
 */
const calculateLinkScores = (
    siteShardPaths: Record<string, ShardPath>,
    linkRules: Record<string, ShardLinkScoringRule>,
    windowBounds: JumpWindowBounds
): LinkScoringResult => {
    const linkPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
    const linksBreakdown: Partial<Record<FactionId, Record<string, number>>> = {};

    for (const path of Object.values(siteShardPaths)) {
        for (const link of path.links) {
            if (link.team === "RES" || link.team === "ENL") {
                processLinkMoves(link, link.team, windowBounds, linkRules, linkPoints, linksBreakdown);
            }
        }
    }

    return { linkPoints, linksBreakdown };
};

export const WaveShardJumpBuilder = {
    build: (
        wave: { start: number; end: number; shardsActions?: ScheduledShardAction[] },
        shards: Map<number, Shard>,
        portals: Record<PortalId, ObservedPortal>,
        siteShardPaths: Record<string, ShardPath>,
        goalRules: Record<string, ShardGoalScoringRule>,
        linkRules: Record<string, ShardLinkScoringRule>,
        timeline: EventTimeline
    ): ShardJumpWindow[] => {
        if (!wave.shardsActions) {
            throw new Error("shardsActions must be provided in the event blueprint.");
        }

        const jumpActions = wave.shardsActions.filter((a) => a.action === "jump");

        if (jumpActions.length > 0) {
            const firstJumpTime = jumpActions[0]!.time;
            for (const s of shards.values()) {
                for (const h of s.history) {
                    if (["jump", "link", "no move"].includes(h.action)) {
                        if (h.moveTime >= wave.start && h.moveTime < firstJumpTime) {
                            console.warn(`[WaveShardJumpBuilder] Orphaned jump/link movement detected at time ${h.moveTime} (before first scheduled jump at ${firstJumpTime}). This movement will not be scored.`);
                        }
                    }
                }
            }
        }

        const shardJumpWindows: ShardJumpWindow[] = [];
        const waveScoredGoals = new Map<PortalId, Set<number>>();

        for (const [i, act] of jumpActions.entries()) {
            const jumpNumber = i + 1;
            const nextWindowStart = jumpActions[i + 1]?.time;
            const windowBounds: JumpWindowBounds = {
                windowStart: act.time,
                ...(nextWindowStart !== undefined && { nextWindowStart }),
                waveStart: wave.start,
                waveEnd: wave.end
            };

            const { jumpHistory, jumpMismatchedLinks } = collectWindowHistory(shards, siteShardPaths, windowBounds);

            if (jumpHistory.length === 0) {
                continue;
            }

            const { linkPoints, linksBreakdown } = calculateLinkScores(siteShardPaths, linkRules, windowBounds);

            const goalResult = GoalScoringEngine.scoreJumpWindow(
                shards,
                portals,
                goalRules,
                timeline,
                waveScoredGoals,
                windowBounds
            );

            const jumpWindowPoints: Record<FactionId, number> = {
                RES: (linkPoints.RES ?? 0) + (goalResult.jumpWindowPoints.RES ?? 0),
                ENL: (linkPoints.ENL ?? 0) + (goalResult.jumpWindowPoints.ENL ?? 0),
                MAC: (linkPoints.MAC ?? 0) + (goalResult.jumpWindowPoints.MAC ?? 0),
                NEU: (linkPoints.NEU ?? 0) + (goalResult.jumpWindowPoints.NEU ?? 0)
            };

            const mismatches: Partial<Record<FactionId, number>> = {};
            for (const team of jumpMismatchedLinks.values()) {
                mismatches[team] = (mismatches[team] ?? 0) + 1;
            }

            const factionBreakdowns: Partial<Record<FactionId, FactionPointsBreakdown>> = {};
            for (const f of ["RES", "ENL", "MAC", "NEU"] as FactionId[]) {
                const factionLinks = linksBreakdown[f];
                const factionGoals = goalResult.goalsBreakdown[f];
                const factionMismatches = mismatches[f];

                if (factionLinks || factionGoals || factionMismatches !== undefined) {
                    factionBreakdowns[f] = {
                        ...(factionLinks && { links: factionLinks }),
                        ...(factionGoals && { goals: factionGoals }),
                        ...(factionMismatches !== undefined && { linkAlignmentMismatches: factionMismatches })
                    };
                }
            }

            const pointsObject: Partial<Record<FactionId, number>> = {};
            if (jumpWindowPoints.RES && jumpWindowPoints.RES > 0) pointsObject.RES = roundToDecimalPlaces(jumpWindowPoints.RES, 2);
            if (jumpWindowPoints.ENL && jumpWindowPoints.ENL > 0) pointsObject.ENL = roundToDecimalPlaces(jumpWindowPoints.ENL, 2);

            shardJumpWindows.push({
                timestamp: windowBounds.windowStart,
                jumpNumber,
                points: pointsObject,
                ...(Object.keys(factionBreakdowns).length > 0 && { factionBreakdowns }),
                historyCount: jumpHistory.length
            });
        }

        return shardJumpWindows;
    }
};
