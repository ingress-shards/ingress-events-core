import { isMoveMismatched, type Link, type Shard, type ShardHistoryEntry, type ShardPath } from "../../sites/Shard.js";
import type { ShardJumpWindow } from "../../sites/Site.js";
import type { FactionPoints, PointsSummary } from "../../sites/Scoring.js";
import type { FactionId } from "../../common/Alignment.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";
import { roundToDecimalPlaces } from "../../common/Math.js";
import { TargetScoringEngine } from "./TargetScoringEngine.js";
import { isMovementInWindow, type JumpWindowBounds } from "./JumpWindowUtilities.js";

interface ScoredLinkAggregation {
    linkPoints: Record<FactionId, number>;
    linksBreakdown: Partial<Record<FactionId, Record<string, number>>>;
    mismatchedScoringJumps: Partial<Record<FactionId, number>>;
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

    /**
     * Gathers all shard movements in the jump window to determine action count and actual end.
     */
    private collectWindowHistory(windowBounds: JumpWindowBounds): ShardHistoryEntry[] {
        const jumpHistory: ShardHistoryEntry[] = [];
        for (const s of this.shards.values()) {
            if (!s?.history) continue;
            for (const h of s.history) {
                if (isMovementInWindow(h, windowBounds)) {
                    jumpHistory.push(h);
                }
            }
        }
        return jumpHistory;
    }

    private aggregateLink(
        link: Link,
        windowBounds: JumpWindowBounds
    ): { points: number; breakdown: Record<string, number>; mismatchedJumps: number } {
        let points = 0;
        const breakdown: Record<string, number> = {};
        let mismatchedJumps = 0;

        for (const move of link.moves) {
            if (!isMovementInWindow({ action: "link", moveTime: move.moveTime }, windowBounds) || !move.scoredRules?.length) {
                continue;
            }

            points += move.totalPoints ?? 0;

            for (const ruleId of move.scoredRules) {
                breakdown[ruleId] = (breakdown[ruleId] ?? 0) + 1;
            }

            if (isMoveMismatched(move, this.shards)) {
                mismatchedJumps++;
            }
        }

        return { points, breakdown, mismatchedJumps };
    }

    /**
     * Aggregates pre-scored shard link movements that occurred within the jump window.
     */
    private aggregateLinkScores(windowBounds: JumpWindowBounds): ScoredLinkAggregation {
        const linkPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };
        const linksBreakdown: Partial<Record<FactionId, Record<string, number>>> = {};
        const mismatchedScoringJumps: Partial<Record<FactionId, number>> = {};

        const allLinks = Object.values(this.shardPaths).flatMap((p) => p.links);

        for (const link of allLinks) {
            if (link.align === "NEU") {
                continue;
            }
            const faction = link.align;
            const result = this.aggregateLink(link, windowBounds);

            linkPoints[faction] += result.points;

            if (Object.keys(result.breakdown).length > 0) {
                const teamBreakdown = linksBreakdown[faction] ??= {};
                for (const [ruleId, count] of Object.entries(result.breakdown)) {
                    teamBreakdown[ruleId] = (teamBreakdown[ruleId] ?? 0) + count;
                }
            }

            if (result.mismatchedJumps > 0) {
                mismatchedScoringJumps[faction] = (mismatchedScoringJumps[faction] ?? 0) + result.mismatchedJumps;
            }
        }

        return { linkPoints, linksBreakdown, mismatchedScoringJumps };
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

            const jumpHistory = this.collectWindowHistory(windowBounds);

            if (jumpHistory.length === 0) {
                continue;
            }

            const { linkPoints, linksBreakdown, mismatchedScoringJumps } = this.aggregateLinkScores(windowBounds);
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

            const cleanWindowTotal = this.cleanPoints(jumpWindowPoints);
            const cleanWindowLinks = this.cleanPoints(linkPoints);
            const cleanWindowGoals = this.cleanPoints(goalResult.jumpWindowPoints);

            const windowPoints: PointsSummary = {
                ...(Object.keys(cleanWindowTotal).length > 0 && { total: cleanWindowTotal }),
                ...(Object.keys(cleanWindowLinks).length > 0 && { links: cleanWindowLinks }),
                ...(Object.keys(cleanWindowGoals).length > 0 && { goals: cleanWindowGoals }),
            };

            shardJumpWindows.push({
                scheduledStart: windowBounds.windowStart,
                actualEnd: Math.max(...jumpHistory.map((h) => h.moveTime)),
                jumpNumber,
                actionCount: jumpHistory.length,
                ...(Object.keys(windowPoints).length > 0 && { points: windowPoints }),
                ...(Object.keys(linksBreakdown).length > 0 && { linksBreakdown }),
                ...(Object.keys(goalResult.goalsBreakdown).length > 0 && { goalsBreakdown: goalResult.goalsBreakdown }),
                ...(Object.keys(mismatchedScoringJumps).length > 0 && { mismatchedScoringJumps }),
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
