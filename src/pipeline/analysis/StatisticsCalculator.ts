import type { Shard, ShardPath } from "../../sites/Shard.js";
import type { ObservedPortal } from "../../sites/Portal.js";
import type { WaveState } from "../../sites/Site.js";
import type { SiteStatistics, WaveStatistics } from "../../sites/Statistics.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { BaseWaveTimeline, ShardWaveTimeline } from "../../config/SiteConfig.js";
import { STANDARD_JUMP_WINDOW_DURATION_MS } from "../../common/Date.js";

export class StatisticsCalculator {
    constructor(
        private readonly shards: Map<number, Shard>,
        private readonly portals: Record<PortalId, ObservedPortal>,
        private readonly paths: Record<string, ShardPath>
    ) {}

    private countWaveMovingShards(wave: BaseWaveTimeline): { moving: number; nonMoving: number } {
        const waveEndLimit = wave.shardsActions?.some(a => a.action === "despawn") ? wave.end + 55000 : wave.end;
        let moving = 0;
        let nonMoving = 0;

        for (const shard of this.shards.values()) {
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
                moving++;
            } else {
                nonMoving++;
            }
        }

        return { moving, nonMoving };
    }

    /**
     * Calculates operational telemetry statistics for an individual wave.
     * Contains basic physical metrics (shards, links, paths, targets); zero diagnostic anomalies.
     */
    public calculateWaveStatistics(wave: BaseWaveTimeline): WaveStatistics {
        const waveEndLimit = wave.shardsActions?.some(a => a.action === "despawn") ? wave.end + 55000 : wave.end;
        const shards = this.countWaveMovingShards(wave);

        const targetsCount = Object.values(this.portals).filter(p => p.history?.some(h => {
            if (h.type !== "target") return false;
            return h.timestamp >= wave.start && h.timestamp <= wave.end;
        })).length;

        let linksCount = 0;
        const pathsSet = new Set<string>();

        for (const [pathKey, path] of Object.entries(this.paths)) {
            const waveLinks = path.links.filter(l => l.linkTime >= wave.start && l.linkTime <= waveEndLimit);
            if (waveLinks.length > 0) {
                linksCount += waveLinks.length;
                pathsSet.add(pathKey);
            }
        }

        return {
            shards,
            links: linksCount,
            paths: pathsSet.size,
            ...(targetsCount > 0 && { targets: targetsCount }),
        };
    }

    /**
     * Calculates site-wide operational and diagnostic statistics in a single pass.
     * Evaluates shard wave movements and active targets across all timeline waves when present.
     */
    public calculateSiteStatistics(waveStates?: WaveState[], waves?: ShardWaveTimeline[]): SiteStatistics {
        let totalMoving = 0;
        let totalNonMoving = 0;
        let targetsCount = 0;

        if (waves && waves.length > 0) {
            for (const wave of waves) {
                const waveShards = this.countWaveMovingShards(wave);
                totalMoving += waveShards.moving;
                totalNonMoving += waveShards.nonMoving;

                targetsCount += Object.values(this.portals).filter(p => p.history?.some(h => {
                    if (h.type !== "target") return false;
                    return h.timestamp >= wave.start && h.timestamp <= wave.end;
                })).length;
            }
        } else {
            for (const shard of this.shards.values()) {
                const history = shard.history || [];
                if (history.length === 0) continue;

                const hasMoved = history.some(h => h.action === "jump" || h.action === "link");
                if (hasMoved) {
                    totalMoving++;
                } else {
                    totalNonMoving++;
                }
            }

            targetsCount = Object.values(this.portals).filter(p =>
                p.history?.some(h => h.type === "target")
            ).length;
        }

        let totalInvalidActions = 0;
        let totalMismatchedMoves = 0;
        for (const shard of this.shards.values()) {
            const history = shard.history || [];
            totalInvalidActions += history.filter(h => h.invalid === true).length;
            totalMismatchedMoves += history.filter(h => h.mismatch !== undefined).length;
        }

        const totalUniqueLinks = Object.values(this.paths).reduce(
            (accumulator, path) => accumulator + path.links.length,
            0
        );

        const extendedJumpWindows = waveStates?.flatMap(ws => ws.shardJumpWindows).filter(
            w => (w.actualEnd - w.scheduledStart) > STANDARD_JUMP_WINDOW_DURATION_MS
        ).length ?? 0;

        return {
            shards: {
                moving: totalMoving,
                nonMoving: totalNonMoving
            },
            links: totalUniqueLinks,
            paths: Object.keys(this.paths).length,
            ...(targetsCount > 0 && { targets: targetsCount }),
            ...(totalMismatchedMoves > 0 && { mismatchedMoves: totalMismatchedMoves }),
            ...(extendedJumpWindows > 0 && { extendedJumpWindows }),
            ...(totalInvalidActions > 0 && { invalidActions: totalInvalidActions })
        };
    }
}
