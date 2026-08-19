import type { Shard, ShardPath } from "../Shard.js";
import type { WaveState, PointsSnapshot, Statistics } from "../Site.js";
import type { ObservedPortal } from "../Portal.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { FactionId } from "../../common/Factions.js";
import type { ShardGoalScoringRule, ShardLinkScoringRule } from "../../types/index.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";
import { ShardPathBuilder } from "./ShardPathBuilder.js";
import { WaveActionLogBuilder } from "./WaveActionLogBuilder.js";
import { GoalScoringEngine } from "./GoalScoringEngine.js";
import { roundToDecimalPlaces } from "../../common/Math.js";

export const WaveAnalyser = {
    countWaveShardMovement: (
        shards: Map<number, Shard>,
        wave: { start: number; end: number; shardsActions?: any[] },
        counters: { moving: number; nonMoving: number; links: number }
    ): void => {
        const waveEndLimit = wave.shardsActions?.some(a => a.action === "despawn") ? wave.end + 55000 : wave.end;
        for (const shard of shards.values()) {
            const history = shard.history || [];
            const historyUpToWaveEnd = history.filter(h => h.moveTime <= waveEndLimit);
            if (historyUpToWaveEnd.length === 0) continue;

            const latestBeforeWave = historyUpToWaveEnd.at(-1)!;
            if (latestBeforeWave.action === "despawn" && latestBeforeWave.moveTime < wave.start) {
                continue;
            }

            const waveHistory = history.filter(h => h.moveTime >= wave.start && h.moveTime <= waveEndLimit);
            const hasMoved = waveHistory.some(h => h.action === "jump" || h.action === "link");

            if (hasMoved) {
                counters.moving++;
            } else {
                counters.nonMoving++;
            }

            counters.links += waveHistory.filter(h => h.action === "link").length;
        }
    },

    buildWaveState: (
        waveNum: number,
        wave: { start: number; end: number; shardsActions?: any[] },
        shards: Map<number, Shard>,
        portals: Record<PortalId, ObservedPortal>,
        siteShardPaths: Record<string, ShardPath>,
        goalRules: Record<string, ShardGoalScoringRule>,
        linkRules: Record<string, ShardLinkScoringRule>,
        timeline: EventTimeline
    ): WaveState => {
        const waveEndLimit = wave.shardsActions?.some(a => a.action === "despawn") ? wave.end + 55000 : wave.end;
        // Paths are now passed in globally scored (`siteShardPaths`)
        // Filter to count how many paths had moves within this wave's timeframe
        const wavePathCount = Object.values(siteShardPaths).filter(path => 
            path.links.some(link => link.moves.some(m => m.moveTime >= wave.start && m.moveTime <= waveEndLimit))
        ).length;

        const counters = { moving: 0, nonMoving: 0, links: 0 };
        WaveAnalyser.countWaveShardMovement(shards, wave, counters);

        const waveTotalPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const waveLinksPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const waveGoalsPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };

        const processMove = (move: any, link: any) => {
            if (!(move.moveTime >= wave.start && move.moveTime <= waveEndLimit && move.scoredRules && move.scoredRules.length > 0)) {
            	return;
            }

            const team = link.team as FactionId;
            if (team === "RES" || team === "ENL") {
                for (const ruleId of move.scoredRules) {
                    const points = linkRules[ruleId]?.points ?? 0;
                    waveLinksPoints[team] += points;
                    waveTotalPoints[team] += points;
                }
            }
        };

        const extractLinkScore = (path: ShardPath) => {
            for (const link of path.links) {
                for (const move of link.moves) {
                    processMove(move, link);
                }
            }
        };

        // Aggregate points for this wave from siteShardPaths (links)
        for (const path of Object.values(siteShardPaths)) {
            extractLinkScore(path);
        }

        // Aggregate goal points for this wave
        const waveGoalPoints = GoalScoringEngine.scoreWave(wave, shards, portals, goalRules, timeline);
        for (const f of ["RES", "ENL", "MAC", "NEU"] as FactionId[]) {
            waveGoalsPoints[f] = waveGoalPoints[f] ?? 0;
            waveTotalPoints[f] += waveGoalsPoints[f];
        }

        // Generate UI log breakdown
        const shardActionWindows = WaveActionLogBuilder.buildShardActionWindows(
            wave,
            shards,
            portals,
            siteShardPaths,
            goalRules,
            linkRules,
            timeline
        );

        const cleanPoints = (pts: Record<FactionId, number>): PointsSnapshot["links"] => {
            const cleanResult: PointsSnapshot["links"] = {};
            if (pts.RES && pts.RES > 0) cleanResult.RES = roundToDecimalPlaces(pts.RES, 2);
            if (pts.ENL && pts.ENL > 0) cleanResult.ENL = roundToDecimalPlaces(pts.ENL, 2);
            return cleanResult;
        };

        const totalPoints: PointsSnapshot = {
            total: {
                ...(waveTotalPoints.RES > 0 && { RES: roundToDecimalPlaces(waveTotalPoints.RES, 2) }),
                ...(waveTotalPoints.ENL > 0 && { ENL: roundToDecimalPlaces(waveTotalPoints.ENL, 2) })
            },
            links: cleanPoints(waveLinksPoints)
        };

        const hasGoalPoints = waveGoalsPoints.RES > 0 || waveGoalsPoints.ENL > 0;
        if (hasGoalPoints) {
            totalPoints.goals = cleanPoints(waveGoalsPoints);
        }

        const targetsCount = Object.values(portals).filter(p => p.history?.some(h => {
            if (h.type !== "target") return false;
            return h.timestamp >= wave.start && h.timestamp <= wave.end;
        })).length;

        const statistics: Statistics = {
            shards: {
                moving: counters.moving,
                nonMoving: counters.nonMoving
            },
            links: counters.links,
            paths: wavePathCount,
            linkAlignmentMismatch: ShardPathBuilder.countLinkAlignmentMismatches(siteShardPaths, mTime => mTime >= wave.start && mTime <= waveEndLimit),
            targetsCount
        };

        return {
            points: totalPoints,
            statistics,
            shardActionWindows
        };
    }
};
