import type { Shard, ShardHistoryEntry, ShardPath } from "../Shard.js";
import type { ShardActionWindow, FactionPointsBreakdown } from "../Site.js";
import type { ObservedPortal } from "../Portal.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { FactionId } from "../../common/Factions.js";
import type { ShardGoalScoringRule, ShardLinkScoringRule } from "../../types/index.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";
import { roundToDecimalPlaces } from "../../common/Math.js";
import { GoalScoringEngine } from "./GoalScoringEngine.js";

interface ActionTimelineItem {
    time: number;
    displayTime: number;
    action: string;
    label: string;
    isMatch: (h: { action: string; moveTime: number }) => boolean;
}

const getActionLabel = (act: any, actions: any[], index: number): string => {
    switch (act.action) {
        case "jump": {
            const jumpIndex = actions.slice(0, index + 1).filter((a: any) => a.action === "jump").length;
            return `J${jumpIndex}`;
        }
        case "spawn": {
            return "Spawn";
        }
        case "despawn": {
            return "Despawn";
        }
        default: {
            return String(act.action);
        }
    }
};

export const WaveActionLogBuilder = {
    buildShardActionWindows: (
        wave: { start: number; end: number; shardsActions?: any[] },
        shards: Map<number, Shard>,
        portals: Record<PortalId, ObservedPortal>,
        siteShardPaths: Record<string, ShardPath>,
        goalRules: Record<string, ShardGoalScoringRule>,
        linkRules: Record<string, ShardLinkScoringRule>,
        timeline: EventTimeline
    ): ShardActionWindow[] => {
        if (!wave.shardsActions) {
            throw new Error("shardsActions must be provided in the event blueprint.");
        }

        const allActions = wave.shardsActions || [];
        const actions = allActions.filter((a: any) => a.action === "jump");
        const jumpActions = actions;

        if (jumpActions.length > 0) {
            const firstJumpTime = Number(jumpActions[0]!.time);
            for (const s of shards.values()) {
                for (const h of s.history) {
                    if (["jump", "link", "no move"].includes(h.action)) {
                        if (h.moveTime >= wave.start && h.moveTime < firstJumpTime) {
                            console.warn(`[WaveActionLogBuilder] Orphaned jump/link movement detected at time ${h.moveTime} (before first scheduled jump at ${firstJumpTime}). This movement will not be scored.`);
                        }
                    }
                }
            }
        }

        const actionTimeline: ActionTimelineItem[] = actions.map((act, i) => {
            const time = Number(act.time);
            const label = getActionLabel(act, actions, i);
            
            let isMatch: (h: { action: string; moveTime: number }) => boolean;

            switch (act.action) {
                case "jump": {
                    isMatch = (h) => {
                        if (h.moveTime < wave.start || h.moveTime > wave.end) return false;
                        if (!["jump", "link", "no move"].includes(h.action)) return false;
                        const startedJumps = jumpActions.filter(j => h.moveTime >= Number(j.time));
                        if (startedJumps.length === 0) return false;
                        const lastStartedJump = startedJumps.at(-1)!;
                        return Number(lastStartedJump.time) === time;
                    };
                    break;
                }
                default: {
                    isMatch = () => false;
                    break;
                }
            }

            return {
                time,
                displayTime: time,
                action: act.action,
                label,
                isMatch
            };
        });

        const shardActionWindows: ShardActionWindow[] = [];
        const processShard = (
            sId: number, 
            s: Shard, 
            actionInfo: ActionTimelineItem, 
            tickHistory: ShardHistoryEntry[], 
            tickMismatchedLinks: Map<string, FactionId>
        ) => {
            if (!s) return;
            const tickHistoryEntries = s.history.filter(h => actionInfo.isMatch(h));
            for (const h of tickHistoryEntries) {
                tickHistory.push(h);
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
                            tickMismatchedLinks.set(pathKey, h.team);
                        }
                    }
                }
            }
        };

        const waveScoredGoals = new Map<PortalId, Set<number>>();

        for (const actionInfo of actionTimeline) {
            const timestamp = actionInfo.displayTime;
            const tickHistory: ShardHistoryEntry[] = [];
            const tickMismatchedLinks = new Map<string, FactionId>(); // Keep track of mismatched links to count per-link

            for (const [sId, s] of shards) {
                processShard(sId, s, actionInfo, tickHistory, tickMismatchedLinks);
            }

            if (tickHistory.length > 0) {
                const tickPoints: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
                const linksBreakdown: Partial<Record<FactionId, Record<string, number>>> = {};

                const processMove = (move: any, link: any) => {
                    if (!(actionInfo.isMatch({ action: "link", moveTime: move.moveTime }) && move.scoredRules && move.scoredRules.length > 0)) {
                    	return;
                    }

                    const attributionTeam = link.team as FactionId;
                    if (attributionTeam === "RES" || attributionTeam === "ENL") {
                        const teamBreakdown = linksBreakdown[attributionTeam] ??= {};
                        for (const ruleId of move.scoredRules) {
                            teamBreakdown[ruleId] = (teamBreakdown[ruleId] ?? 0) + 1;
                            const points = linkRules[ruleId]?.points ?? 0;
                            tickPoints[attributionTeam] = (tickPoints[attributionTeam] ?? 0) + points;
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

                // Look up link points using scoredRules
                for (const path of Object.values(siteShardPaths)) {
                    extractLinkScore(path);
                }

                // Look up goal points using GoalScoringEngine
                const goalResult = GoalScoringEngine.scoreTick(
                    timestamp,
                    shards,
                    portals,
                    goalRules,
                    timeline,
                    waveScoredGoals,
                    actionInfo.isMatch
                );

                for (const f of ["RES", "ENL", "MAC", "NEU"] as FactionId[]) {
                    tickPoints[f] = (tickPoints[f] ?? 0) + (goalResult.tickPoints[f] ?? 0);
                }

                // Build mismatches map from the per-link Map
                const mismatches: Partial<Record<FactionId, number>> = {};
                for (const team of tickMismatchedLinks.values()) {
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
                if (tickPoints.RES && tickPoints.RES > 0) pointsObject.RES = roundToDecimalPlaces(tickPoints.RES, 2);
                if (tickPoints.ENL && tickPoints.ENL > 0) pointsObject.ENL = roundToDecimalPlaces(tickPoints.ENL, 2);

                shardActionWindows.push({
                    timestamp,
                    actionType: actionInfo.action as any,
                    actionLabel: actionInfo.label,
                    points: pointsObject,
                    ...(Object.keys(factionBreakdowns).length > 0 && { factionBreakdowns }),
                    actionsCount: tickHistory.length
                });
            }

        }

        return shardActionWindows;
    }
};
