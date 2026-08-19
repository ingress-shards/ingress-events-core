import type { ShardPath, Link, ShardMove } from "../Shard.js";
import type { ShardLinkScoringRule } from "../../types/index.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ObservedPortal, PortalHistoryEntry } from "../Portal.js";
import type { EventTimeline } from "../../seasons/SeasonConfig.js";

export const LinkScoringEngine = {
    createScorer: (
        rules: Record<string, ShardLinkScoringRule>,
        portals: Record<PortalId, ObservedPortal>,
        timeline: EventTimeline
    ) => {
        const scoreLocked = new Map<number, Set<number>>();

        return (move: ShardMove, link: Link, path: ShardPath): string[] => {
            const scoredRules: string[] = [];

            // 1. Determine which shard wave this move falls into
            const wave = timeline.shards.find(w => move.moveTime >= w.start && move.moveTime <= w.end);
            if (!wave) {
                return scoredRules;
            }
            const waveNum = wave.waveNumber;

            // Check if this shard is score-locked for this wave
            const waveLockedShards = scoreLocked.get(waveNum);
            if (waveLockedShards?.has(move.shardId)) {
                return scoredRules;
            }

        if (!["RES", "ENL", "MAC"].includes(link.team)) {
            console.warn(`[Site Observer: LinkScoringEngine] Neutral link found: wave ${waveNum}, shard ${move.shardId} at ${link.linkTime}, ignoring.`);
            return scoredRules;
        }

        for (const [ruleId, rule] of Object.entries(rules)) {
            if (rule.conditions) {
                const cond = rule.conditions;

                if (cond.minDistance !== undefined && path.distance < cond.minDistance) {
                    continue;
                }
                if (cond.maxDistance !== undefined && path.distance > cond.maxDistance) {
                    continue;
                }

                if (cond.ornaments && cond.ornaments.length > 0) {
                    const destinationPortal = portals[move.dest];
                    const hasMatchingOrnament = destinationPortal?.history?.some((h: PortalHistoryEntry) => 
                        h.type === "pre-event" && h.ornId && cond.ornaments?.includes(h.ornId)
                    );
                    if (!hasMatchingOrnament) {
                        continue;
                    }
                }
            }

            // If we get here, the rule matched and scored
            scoredRules.push(ruleId);

            // Lock this shard from further scoring in this wave if the rule disallows it
            if (rule.conditions?.allowFurtherPoints === false) {
                if (!scoreLocked.has(waveNum)) {
                    scoreLocked.set(waveNum, new Set());
                }
                scoreLocked.get(waveNum)!.add(move.shardId);
            }
        }

        return scoredRules;
        };
    }
};
