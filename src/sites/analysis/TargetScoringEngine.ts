import type { Shard } from "../Shard.js";
import type { ObservedPortal } from "../Portal.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { FactionId } from "../../common/Alignment.js";
import type { ShardGoalScoringRule } from "../../types/index.js";
import type { TargetGoalDetail } from "../Scoring.js";
import type { SiteTimeline } from "../../config/SiteConfig.js";

import { isMovementInWindow, type JumpWindowBounds } from "./JumpWindowUtilities.js";

export interface JumpWindowGoalResult {
    jumpWindowPoints: Record<FactionId, number>;
    goalsBreakdown: Partial<Record<FactionId, TargetGoalDetail[]>>;
}

export class TargetScoringEngine {
    private readonly scoredGoalsPerPortal = new Map<PortalId, Set<number>>();

    constructor(
        private readonly rules: Record<string, ShardGoalScoringRule>,
        private readonly timeline: SiteTimeline | undefined,
        private readonly shards: Map<number, Shard>,
        private readonly portals: Record<PortalId, ObservedPortal>
    ) {}

    public scoreJumpWindow(windowBounds: JumpWindowBounds): JumpWindowGoalResult {
        const jumpWindowPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };
        const goalsBreakdown: Partial<Record<FactionId, TargetGoalDetail[]>> = {};

        const { windowStart } = windowBounds;
        const targetWave = this.timeline?.targets?.find(tw => windowStart >= tw.start && windowStart <= tw.end);
        const targetRule = Object.values(this.rules)[0];

        if (!targetWave || !targetRule) {
            return { jumpWindowPoints, goalsBreakdown };
        }

        const activeTargets = Object.entries(this.portals).filter(([, p]) => {
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
            for (const [sId, s] of this.shards) {
                const hasJumpToPortal = s.history.some(h => 
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
                    if (!this.scoredGoalsPerPortal.has(portalId)) {
                        this.scoredGoalsPerPortal.set(portalId, new Set());
                    }
                    const scoredSet = this.scoredGoalsPerPortal.get(portalId)!;
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
                    ...(scoredCount > 0 && { scoredCount }),
                    ...(unscoredCount > 0 && { unscoredCount })
                });
            }
        }

        return { jumpWindowPoints, goalsBreakdown };
    }
}
