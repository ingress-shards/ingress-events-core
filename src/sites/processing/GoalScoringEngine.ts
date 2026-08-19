import type { Shard } from "../Shard.js";
import type { ObservedPortal } from "../Portal.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { FactionId } from "../../common/Factions.js";
import type { ShardGoalScoringRule } from "../../types/index.js";
import type { GoalActionDetail } from "../Site.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

export interface TickGoalScoringResult {
    tickPoints: Record<FactionId, number>;
    goalsBreakdown: Partial<Record<FactionId, GoalActionDetail[]>>;
}

export const GoalScoringEngine = {

    scoreTick: (
        timestamp: number,
        shards: Map<number, Shard>,
        portals: Record<PortalId, ObservedPortal>,
        rules: Record<string, ShardGoalScoringRule>,
        timeline: EventTimeline,
        waveScoredGoals: Map<PortalId, Set<number>>,
        isMatch: (h: { action: string; moveTime: number }) => boolean
    ): TickGoalScoringResult => {
        const tickPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const goalsBreakdown: Partial<Record<FactionId, GoalActionDetail[]>> = {};

        const targetWave = timeline.targets?.find(tw => timestamp >= tw.start && timestamp <= tw.end);
        const targetRule = Object.values(rules)[0];

        if (!targetWave || !targetRule) {
            return { tickPoints, goalsBreakdown };
        }

        const activeTargets = Object.entries(portals).filter(([, p]) => {
            return p.history?.some(h => 
                h.type === "target" && h.timestamp >= targetWave.start && h.timestamp <= targetWave.end
            );
        });

        for (const [pIdStr, portal] of activeTargets) {
            const portalId = Number(pIdStr);
            let targetOwner: FactionId | undefined;
            const portalTargetHistory = portal.history?.filter(h => 
                h.type === "target" && h.timestamp >= targetWave.start && h.timestamp <= targetWave.end
            ) ?? [];
            
            const lastTarget = portalTargetHistory.at(-1);
            if (lastTarget?.type === "target") {
                if (lastTarget.ornId === "targetres") {
                    targetOwner = "RES";
                } else if (lastTarget.ornId === "targetenl") {
                    targetOwner = "ENL";
                }
            }

            if (!targetOwner) continue;

            const shardsOnPortal: number[] = [];
            for (const [sId, s] of shards) {
                const hasJumpToPortal = s.history?.some(h => 
                    isMatch(h) && 
                    (h.action === "jump" || h.action === "link") && 
                    h.dest === portalId
                );
                if (hasJumpToPortal) {
                    shardsOnPortal.push(sId);
                }
            }

            if (shardsOnPortal.length === 0) continue;

            let scoredCount = 0;
            let unscoredCount = 0;

            for (const sId of shardsOnPortal) {
                let willScore = true;
                if (targetRule.conditions?.maxScoringShardsPerPortal !== undefined) {
                    if (!waveScoredGoals.has(portalId)) {
                        waveScoredGoals.set(portalId, new Set());
                    }
                    const scoredSet = waveScoredGoals.get(portalId)!;
                    if (scoredSet.size >= targetRule.conditions.maxScoringShardsPerPortal && !scoredSet.has(sId)) {
                        willScore = false;
                    } else {
                        scoredSet.add(sId);
                    }
                }
                
                if (willScore) {
                    scoredCount++;
                    tickPoints[targetOwner] = (tickPoints[targetOwner] ?? 0) + targetRule.points;
                } else {
                    unscoredCount++;
                }
            }

            if (scoredCount > 0 || unscoredCount > 0) {
                goalsBreakdown[targetOwner] ??= [];
                goalsBreakdown[targetOwner]!.push({
                    portalId,
                    scoredCount,
                    unscoredCount
                });
            }
        }

        return { tickPoints, goalsBreakdown };
    },

    scoreWave: (
        wave: { start: number; end: number; shardsActions?: any[] },
        shards: Map<number, Shard>,
        portals: Record<PortalId, ObservedPortal>,
        rules: Record<string, ShardGoalScoringRule>,
        timeline: EventTimeline
    ): Record<FactionId, number> => {
        const wavePoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const waveScoredGoals = new Map<PortalId, Set<number>>();

        const allActions = wave.shardsActions ?? [];
        const jumpActions = allActions.filter((a: any) => a.action === "jump");

        for (const act of jumpActions) {
            const time = Number(act.time);
            const isMatch = (h: { action: string; moveTime: number }) => {
                if (h.moveTime < wave.start || h.moveTime > wave.end) return false;
                if (!["jump", "link", "no move"].includes(h.action)) return false;
                const startedJumps = jumpActions.filter((j: any) => h.moveTime >= Number(j.time));
                if (startedJumps.length === 0) return false;
                const lastStartedJump = startedJumps.at(-1)!;
                return Number((lastStartedJump).time) === time;
            };

            const tickResult = GoalScoringEngine.scoreTick(time, shards, portals, rules, timeline, waveScoredGoals, isMatch);
            for (const f of ["RES", "ENL", "MAC", "NEU"] as FactionId[]) {
                wavePoints[f] = (wavePoints[f] ?? 0) + (tickResult.tickPoints[f] ?? 0);
            }
        }
        return wavePoints;
    }
};
