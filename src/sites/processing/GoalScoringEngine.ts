import type { Shard } from "../Shard.js";
import type { ObservedPortal } from "../Portal.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { FactionId } from "../../common/Factions.js";
import type { ShardGoalScoringRule } from "../../types/index.js";
import type { GoalActionDetail } from "../Site.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

import { isMovementInWindow, type JumpWindowBounds } from "./JumpWindowUtilities.js";

export interface JumpWindowGoalResult {
    jumpWindowPoints: Record<FactionId, number>;
    goalsBreakdown: Partial<Record<FactionId, GoalActionDetail[]>>;
}

export const GoalScoringEngine = {
    scoreJumpWindow: (
        shards: Map<number, Shard>,
        portals: Record<PortalId, ObservedPortal>,
        rules: Record<string, ShardGoalScoringRule>,
        timeline: EventTimeline,
        waveScoredGoals: Map<PortalId, Set<number>>,
        windowBounds: JumpWindowBounds
    ): JumpWindowGoalResult => {
        const jumpWindowPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const goalsBreakdown: Partial<Record<FactionId, GoalActionDetail[]>> = {};

        const { windowStart } = windowBounds;
        const targetWave = timeline.targets?.find(tw => windowStart >= tw.start && windowStart <= tw.end);
        const targetRule = Object.values(rules)[0];

        if (!targetWave || !targetRule) {
            return { jumpWindowPoints, goalsBreakdown };
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
                    isMovementInWindow(h, windowBounds) && 
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
                    jumpWindowPoints[targetOwner] = (jumpWindowPoints[targetOwner] ?? 0) + targetRule.points;
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

        return { jumpWindowPoints, goalsBreakdown };
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

        for (const [i, act] of jumpActions.entries()) {
            const nextAction = i + 1 < jumpActions.length ? jumpActions[i + 1] : undefined;
            const windowBounds: JumpWindowBounds = {
                windowStart: Number(act.time),
                ...(nextAction && {nextWindowStart: Number(nextAction.time)}),
                waveStart: wave.start,
                waveEnd: wave.end
            };

            const jumpResult = GoalScoringEngine.scoreJumpWindow(
                shards,
                portals,
                rules,
                timeline,
                waveScoredGoals,
                windowBounds
            );
            for (const f of ["RES", "ENL", "MAC", "NEU"] as FactionId[]) {
                wavePoints[f] = (wavePoints[f] ?? 0) + (jumpResult.jumpWindowPoints[f] ?? 0);
            }
        }
        return wavePoints;
    }
};
