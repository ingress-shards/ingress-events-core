import type { ShardPath, Link, ShardMove } from "../../sites/Shard.js";
import type { ShardLinkScoringRule } from "../../types/index.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ObservedPortal, PortalHistoryEntry } from "../../sites/Portal.js";
import type { SiteTimeline } from "../../config/SiteConfig.js";

export class LinkScoringEngine {
    private readonly scoreLocked = new Map<number, Set<number>>();

    constructor(
        private readonly rules: Record<string, ShardLinkScoringRule>,
        private readonly portals: Record<PortalId, ObservedPortal>,
        private readonly timeline: SiteTimeline
    ) {}

    private scoreMove(move: ShardMove, link: Link, path: ShardPath): string[] {
        const scoredRules: string[] = [];

        // 1. Determine which shard wave this move falls into
        const wave = this.timeline.shards.find(w => move.moveTime >= w.start && move.moveTime <= w.end);
        if (!wave) {
            return scoredRules;
        }
        const waveNum = wave.waveNumber;

        // Check if this shard is score-locked for this wave
        const waveLockedShards = this.scoreLocked.get(waveNum);
        if (waveLockedShards?.has(move.shardId)) {
            return scoredRules;
        }

        if (link.align === "NEU") {
            console.warn(`[Site Observer: LinkScoringEngine] Neutral link found: wave ${waveNum}, shard ${move.shardId} at ${link.linkTime}, ignoring.`);
            return scoredRules;
        }

        for (const [ruleId, rule] of Object.entries(this.rules)) {
            if (rule.conditions) {
                const cond = rule.conditions;

                if (cond.minDistance !== undefined && path.distance < cond.minDistance) {
                    continue;
                }
                if (cond.maxDistance !== undefined && path.distance > cond.maxDistance) {
                    continue;
                }

                if (cond.ornaments && cond.ornaments.length > 0) {
                    const destinationPortal = this.portals[move.dest];
                    const hasMatchingOrnament = destinationPortal?.history?.some((h: PortalHistoryEntry) => 
                        h.type === "pre-event" && cond.ornaments?.includes(h.ornId)
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
                if (!this.scoreLocked.has(waveNum)) {
                    this.scoreLocked.set(waveNum, new Set());
                }
                this.scoreLocked.get(waveNum)!.add(move.shardId);
            }
        }

        return scoredRules;
    }

    public scorePaths(paths: Record<string, ShardPath>): void {
        const allMoves: { move: ShardMove; link: Link; path: ShardPath }[] = [];
        for (const path of Object.values(paths)) {
            for (const link of path.links) {
                for (const move of link.moves) {
                    allMoves.push({ move, link, path });
                }
            }
        }

        // Sort all moves chronologically across all shards for accurate state-locked evaluation
        allMoves.sort((a, b) => a.move.moveTime - b.move.moveTime);
        for (const { move, link, path } of allMoves) {
            const scoredRules = this.scoreMove(move, link, path);
            if (scoredRules.length > 0) {
                move.scoredRules = scoredRules;
            }
            const totalPoints = scoredRules.reduce((sum, rId) => sum + (this.rules[rId]?.points ?? 0), 0);
            if (totalPoints > 0) {
                move.totalPoints = totalPoints;
            }
        }
    }
}
