import type { ShardPath } from "../Shard.js";
import type { ShardScoringRule } from "../../types/index.js";
import type { PortalId } from "../../common/Identifiers.js";
import { type FactionId } from "../../common/Factions.js";
import type { ObservedPortal, PortalHistoryEntry } from "../Portal.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";
import type { Points, PointsSnapshot, PointsBreakdown } from "../Site.js";

export const ScoringEngine = {
    /**
     * Scores the moves inside shardPaths based on rules and portal observations.
     * Modifies the `points` field on each evaluated ShardMove.
     */
    scoreShardPaths: (
        shardPaths: Record<string, ShardPath>,
        rules: Record<string, ShardScoringRule>,
        portals: Record<PortalId, ObservedPortal>,
        timeline: EventTimeline
    ): PointsSnapshot => {
        const total: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const jumpsSummary: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const jumpsDetail: Record<string, Record<FactionId, number>> = {};
        const goalsSummary: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const goalsDetail: Record<string, Record<FactionId, number>> = {};

        // For capping maxScoringShardsPerPortal per wave
        // Map structure: waveNumber -> portalId -> Set of shardIds that have scored at this portal in this wave
        const scoredShardsPerPortalPerWave = new Map<number, Map<PortalId, Set<number>>>();

        for (const path of Object.values(shardPaths)) {
            for (const link of path.links) {
                for (const move of link.moves) {
                    // 1. Determine which shard wave this move falls into
                    const wave = timeline.shards.find(w => move.moveTime >= w.start && move.moveTime <= w.end);
                    if (!wave) {
                        // Move is outside any wave timeline window, does not score
                        continue;
                    }
                    const waveNum = wave.waveNumber;

                    if(!["RES","ENL","MAC"].includes(link.team)) {
                        console.warn(`[Site Observer: ScoringEngine] Neutral link found: wave ${waveNum}, shard ${move.shardId} at ${link.linkTime}, ignoring for scoring.`);
                        continue;
                    }

                    // Reset points for this move
                    move.points = 0;

                    // Evaluate each rule
                    for (const [ruleKey, rule] of Object.entries(rules)) {
                        let matches = true;

                        if (rule.conditions) {
                            const cond = rule.conditions;

                            // Distance check
                            if (cond.minDistance !== undefined && path.distance < cond.minDistance) {
                                matches = false;
                            }
                            if (cond.maxDistance !== undefined && path.distance > cond.maxDistance) {
                                matches = false;
                            }

                            // Ornaments check
                            if (cond.ornaments && cond.ornaments.length > 0) {
                                const destinationPortal = portals[move.dest];
                                const hasMatchingOrnament = destinationPortal?.history?.some((h: PortalHistoryEntry) => 
                                    h.type === "pre-event" && h.ornId && cond.ornaments?.includes(h.ornId)
                                );
                                if (!hasMatchingOrnament) {
                                    matches = false;
                                }
                            }

                            // isTarget check: Verify destination portal is marked as a target portal at move time
                            if (cond.isTarget) {
                                if (!timeline.targets || timeline.targets.length === 0) {
                                    throw new Error("Target timeline is required for rules with isTarget condition");
                                }
                                const destinationPortal = portals[move.dest];
                                const hasTargetOrnament = destinationPortal?.history?.some((h: PortalHistoryEntry) => {
                                    if (h.type !== "target") return false;
                                    const targetWave = timeline.targets!.find(tw => move.moveTime >= tw.start && move.moveTime <= tw.end);
                                    if (!targetWave) return false;
                                    return h.timestamp >= targetWave.start && h.timestamp <= targetWave.end;
                                }) ?? false;

                                if (!hasTargetOrnament) {
                                    matches = false;
                                }
                            }
                        }

                        if (!matches) {
                            continue;
                        }

                        // Capping: maxScoringShardsPerPortal
                        if (rule.maxScoringShardsPerPortal !== undefined) {
                            if (!scoredShardsPerPortalPerWave.has(waveNum)) {
                                scoredShardsPerPortalPerWave.set(waveNum, new Map());
                            }
                            const waveMap = scoredShardsPerPortalPerWave.get(waveNum)!;
                            if (!waveMap.has(move.dest)) {
                                waveMap.set(move.dest, new Set());
                            }
                            const portalSet = waveMap.get(move.dest)!;

                            if (portalSet.size >= rule.maxScoringShardsPerPortal && !portalSet.has(move.shardId)) {
                                // Cap exceeded for new shards on this portal in this wave
                                continue;
                            }
                            portalSet.add(move.shardId);
                        }

                        // Attribution:
                        const teamAttribution = rule.teamAttribution ?? "LINK_OWNER";
                        let attributionTeam: FactionId = link.team; // default is the link team
                        if (teamAttribution === "TARGET_OWNER") {
                            const destinationPortal = portals[move.dest];
                            const targetWave = timeline.targets?.find(tw => move.moveTime >= tw.start && move.moveTime <= tw.end);
                            const targetHistory = destinationPortal?.history?.filter((h: PortalHistoryEntry) => 
                                h.type === "target" && targetWave && h.timestamp >= targetWave.start && h.timestamp <= targetWave.end
                            );
                            if (targetHistory && targetHistory.length > 0) {
                                const latestTarget = targetHistory.at(-1)!;
                                if (latestTarget.type === "target") {
                                    if (latestTarget.ornId === "targetres") {
                                        attributionTeam = "RES";
                                    } else if (latestTarget.ornId === "targetenl") {
                                        attributionTeam = "ENL";
                                    }
                                }
                            }
                        }

                        if (attributionTeam === "RES" || attributionTeam === "ENL") {
                            total[attributionTeam] = (total[attributionTeam] ?? 0) + rule.points;
                            move.points = (move.points ?? 0) + rule.points;

                            const scoreType = rule.scoreType;
                            if (scoreType === "goals") {
                                goalsSummary[attributionTeam] = (goalsSummary[attributionTeam] ?? 0) + rule.points;
                                goalsDetail[ruleKey] ??= { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
                                goalsDetail[ruleKey][attributionTeam] = (goalsDetail[ruleKey][attributionTeam] ?? 0) + rule.points;
                            } else {
                                jumpsSummary[attributionTeam] = (jumpsSummary[attributionTeam] ?? 0) + rule.points;
                                jumpsDetail[ruleKey] ??= { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
                                jumpsDetail[ruleKey][attributionTeam] = (jumpsDetail[ruleKey][attributionTeam] ?? 0) + rule.points;
                            }
                        }
                    }
                }
            }
        }

        const cleanPoints = (pts: Record<FactionId, number>): Points => {
            const resultPts: Points = {};
            if (pts.RES && pts.RES > 0) resultPts.RES = pts.RES;
            if (pts.ENL && pts.ENL > 0) resultPts.ENL = pts.ENL;
            return resultPts;
        };

        const cleanBreakdown = (summary: Record<FactionId, number>, detail: Record<string, Record<FactionId, number>>): PointsBreakdown => {
            const finalDetail: Record<string, Points> = {};
            for (const [key, pts] of Object.entries(detail)) {
                const rulePoints = cleanPoints(pts);
                if (rulePoints.RES !== undefined || rulePoints.ENL !== undefined) {
                    finalDetail[key] = rulePoints;
                }
            }
            return {
                summary: cleanPoints(summary),
                detail: finalDetail
            };
        };

        return {
            total: cleanPoints(total),
            jumps: cleanBreakdown(jumpsSummary, jumpsDetail),
            goals: cleanBreakdown(goalsSummary, goalsDetail)
        };
    }
};
