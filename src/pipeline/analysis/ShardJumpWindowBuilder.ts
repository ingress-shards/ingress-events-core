import type { Shard, ShardHistoryEntry, ShardPath } from "../../sites/Shard.js";
import type { ShardJumpWindow, Diagnostics } from "../../sites/Site.js";
import type { FactionPoints, PointsSummary } from "../../sites/Scoring.js";
import type { Alignment, FactionId } from "../../common/Alignment.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";
import { roundToDecimalPlaces } from "../../common/Math.js";
import { TargetScoringEngine } from "./TargetScoringEngine.js";
import { isMovementInWindow, type JumpWindowBounds } from "./JumpWindowUtilities.js";

interface WindowHistoryResult {
    jumpHistory: ShardHistoryEntry[];
    jumpMismatchedLinks: Map<string, Alignment>;
}

interface LinkScoringResult {
    linkPoints: Record<FactionId, number>;
    linksBreakdown: Partial<Record<FactionId, Record<string, number>>>;
}

export interface WaveWindowsResult {
    shardJumpWindows: ShardJumpWindow[];
    points: PointsSummary;
}

export class ShardJumpWindowBuilder {
    constructor(
        private readonly targetScorer: TargetScoringEngine,
        private readonly shards: Map<number, Shard>,
        private readonly shardPaths: Record<string, ShardPath>
    ) {}

    private cleanPoints(pts: Record<FactionId, number>): FactionPoints {
        const cleanResult: FactionPoints = {};
        for (const [faction, value] of Object.entries(pts)) {
            if (value > 0) {
                cleanResult[faction as FactionId] = roundToDecimalPlaces(value, 2);
            }
        }
        return cleanResult;
    }

    private findScoredMove(path: ShardPath, shardId: number, moveTime: number) {
        for (const link of path.links) {
            for (const move of link.moves) {
                if (move.shardId === shardId && move.moveTime === moveTime) {
                    return move;
                }
            }
        }
        return undefined;
    }

    /**
     * Gathers all shard movements in the jump window and detects alignment mismatches on scored links.
     */
    private collectWindowHistory(windowBounds: JumpWindowBounds): WindowHistoryResult {
        const jumpHistory: ShardHistoryEntry[] = [];
        const jumpMismatchedLinks = new Map<string, Alignment>();

        for (const [sId, s] of this.shards) {
            if (!s?.history) continue;
            const matchingEntries = s.history.filter(h => isMovementInWindow(h, windowBounds));
            for (const h of matchingEntries) {
                jumpHistory.push(h);
                if (h.align && h.mismatch && h.dest !== undefined) {
                    const p1 = Math.min(h.portalId, h.dest);
                    const p2 = Math.max(h.portalId, h.dest);
                    const pathKey = `${p1}-${p2}`;
                    const path = this.shardPaths[pathKey];
                    if (path) {
                        const matchingMove = this.findScoredMove(path, sId, h.moveTime);
                        if (matchingMove?.scoredRules && matchingMove.scoredRules.length > 0) {
                            jumpMismatchedLinks.set(pathKey, h.align);
                        }
                    }
                }
            }
        }

        return { jumpHistory, jumpMismatchedLinks };
    }

    private processLinkMoves(
        link: ShardPath["links"][number],
        attributionFaction: FactionId,
        windowBounds: JumpWindowBounds,
        linkPoints: Record<FactionId, number>,
        linksBreakdown: Partial<Record<FactionId, Record<string, number>>>
    ): void {
        for (const move of link.moves) {
            if (!isMovementInWindow({ action: "link", moveTime: move.moveTime }, windowBounds) || !move.scoredRules || move.scoredRules.length === 0) {
                continue;
            }

            const teamBreakdown = linksBreakdown[attributionFaction] ??= {};
            for (const ruleId of move.scoredRules) {
                teamBreakdown[ruleId] = (teamBreakdown[ruleId] ?? 0) + 1;
            }
            const points = move.totalPoints ?? 0;
            linkPoints[attributionFaction] = (linkPoints[attributionFaction] ?? 0) + points;
        }
    }

    /**
     * Calculates faction points and breakdown for shard link moves occurring within the jump window.
     */
    private calculateLinkScores(windowBounds: JumpWindowBounds): LinkScoringResult {
        const linkPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };
        const linksBreakdown: Partial<Record<FactionId, Record<string, number>>> = {};

        for (const path of Object.values(this.shardPaths)) {
            for (const link of path.links) {
                if (link.align !== "NEU") {
                    this.processLinkMoves(link, link.align, windowBounds, linkPoints, linksBreakdown);
                }
            }
        }

        return { linkPoints, linksBreakdown };
    }

    public buildWaveWindows(wave: ShardWaveTimeline): WaveWindowsResult {
        if (!wave.shardsActions) {
            throw new Error("shardsActions must be provided in the event blueprint.");
        }

        const jumpActions = wave.shardsActions.filter((a) => a.action === "jump");

        if (jumpActions.length > 0) {
            const firstJumpTime = jumpActions[0]!.time;
            for (const s of this.shards.values()) {
                for (const h of s.history) {
                    if (["jump", "link", "no move"].includes(h.action)) {
                        if (h.moveTime >= wave.start && h.moveTime < firstJumpTime) {
                            console.warn(`[ShardJumpWindowBuilder] Orphaned jump/link movement detected at time ${h.moveTime} (before first scheduled jump at ${firstJumpTime}). This movement will not be scored.`);
                        }
                    }
                }
            }
        }

        const shardJumpWindows: ShardJumpWindow[] = [];
        const waveTotalPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };
        const waveLinksPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };
        const waveGoalsPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };

        for (const [i, act] of jumpActions.entries()) {
            const jumpNumber = i + 1;
            const nextWindowStart = jumpActions[i + 1]?.time;
            const windowBounds: JumpWindowBounds = {
                windowStart: act.time,
                ...(nextWindowStart !== undefined && { nextWindowStart }),
                waveStart: wave.start,
                waveEnd: wave.end
            };

            const { jumpHistory, jumpMismatchedLinks } = this.collectWindowHistory(windowBounds);

            if (jumpHistory.length === 0) {
                continue;
            }

            const { linkPoints, linksBreakdown } = this.calculateLinkScores(windowBounds);
            const goalResult = this.targetScorer.scoreJumpWindow(windowBounds);

            const jumpWindowPoints: Record<FactionId, number> = {
                RES: (linkPoints.RES ?? 0) + (goalResult.jumpWindowPoints.RES ?? 0),
                ENL: (linkPoints.ENL ?? 0) + (goalResult.jumpWindowPoints.ENL ?? 0),
                MAC: (linkPoints.MAC ?? 0) + (goalResult.jumpWindowPoints.MAC ?? 0),
            };

            for (const f of ["RES", "ENL", "MAC"] as FactionId[]) {
                waveLinksPoints[f] = (waveLinksPoints[f] ?? 0) + (linkPoints[f] ?? 0);
                waveGoalsPoints[f] = (waveGoalsPoints[f] ?? 0) + (goalResult.jumpWindowPoints[f] ?? 0);
                waveTotalPoints[f] = (waveTotalPoints[f] ?? 0) + (jumpWindowPoints[f] ?? 0);
            }

            const mismatches: Partial<Record<Alignment, number>> = {};
            for (const align of jumpMismatchedLinks.values()) {
                mismatches[align] = (mismatches[align] ?? 0) + 1;
            }

            const cleanWindowTotal = this.cleanPoints(jumpWindowPoints);
            const cleanWindowLinks = this.cleanPoints(linkPoints);
            const cleanWindowGoals = this.cleanPoints(goalResult.jumpWindowPoints);

            const windowPoints: PointsSummary = {
                ...(Object.keys(cleanWindowTotal).length > 0 && { total: cleanWindowTotal }),
                ...(Object.keys(cleanWindowLinks).length > 0 && { links: cleanWindowLinks }),
                ...(Object.keys(cleanWindowGoals).length > 0 && { goals: cleanWindowGoals }),
            };

            const windowDiagnostics: Diagnostics | undefined = Object.keys(mismatches).length > 0
                ? { linkAlignmentMismatches: mismatches }
                : undefined;

            shardJumpWindows.push({
                timestamp: windowBounds.windowStart,
                jumpNumber,
                historyCount: jumpHistory.length,
                ...(Object.keys(windowPoints).length > 0 && { points: windowPoints }),
                ...(Object.keys(linksBreakdown).length > 0 && { linksBreakdown }),
                ...(Object.keys(goalResult.goalsBreakdown).length > 0 && { goalsBreakdown: goalResult.goalsBreakdown }),
                ...(windowDiagnostics && { diagnostics: windowDiagnostics }),
            });
        }

        const cleanedTotal = this.cleanPoints(waveTotalPoints);
        const cleanedLinks = this.cleanPoints(waveLinksPoints);
        const cleanedGoals = this.cleanPoints(waveGoalsPoints);

        const totalPoints: PointsSummary = {
            ...(Object.keys(cleanedTotal).length > 0 && { total: cleanedTotal }),
            ...(Object.keys(cleanedLinks).length > 0 && { links: cleanedLinks }),
            ...(Object.keys(cleanedGoals).length > 0 && { goals: cleanedGoals })
        };

        return {
            shardJumpWindows,
            points: totalPoints
        };
    }
}
