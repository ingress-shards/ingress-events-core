import type { Shard, ShardPath, Link } from "../../sites/Shard.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { Diagnostics, WaveState } from "../../sites/Site.js";
import type { Alignment } from "../../common/Alignment.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";

export class DiagnosticsCalculator {
    constructor(
        public readonly shards: Map<number, Shard>,
        public readonly portals: Record<PortalId, ObservedPortal>,
        public readonly paths: Record<string, ShardPath>
    ) {}

    private hasMismatchedMove(link: Link, waveStart: number, waveEndLimit: number): boolean {
        return link.moves.some(move => {
            const isInTimeWindow = move.moveTime >= waveStart && move.moveTime <= waveEndLimit;
            return move.mismatch === true && isInTimeWindow && move.scoredRules && move.scoredRules.length > 0;
        });
    }

    public calculate(wave: ShardWaveTimeline): Diagnostics | undefined {
        const waveEndLimit = wave.shardsActions?.some(a => a.action === "despawn") ? wave.end + 55000 : wave.end;
        const mismatches: Partial<Record<Alignment, number>> = {};

        for (const path of Object.values(this.paths)) {
            for (const link of path.links) {
                if (this.hasMismatchedMove(link, wave.start, waveEndLimit)) {
                    mismatches[link.align] = (mismatches[link.align] ?? 0) + 1;
                }
            }
        }

        return Object.keys(mismatches).length > 0 ? { linkAlignmentMismatches: mismatches } : undefined;
    }

    public aggregate(waveStates: Record<number, WaveState>): Diagnostics | undefined {
        const totalMismatches: Partial<Record<Alignment, number>> = {};

        for (const ws of Object.values(waveStates)) {
            if (ws.diagnostics?.linkAlignmentMismatches) {
                for (const [align, count] of Object.entries(ws.diagnostics.linkAlignmentMismatches)) {
                    if (count && count > 0) {
                        totalMismatches[align as Alignment] = (totalMismatches[align as Alignment] ?? 0) + count;
                    }
                }
            }
        }

        return Object.keys(totalMismatches).length > 0 ? { linkAlignmentMismatches: totalMismatches } : undefined;
    }
}
