import type { Shard, ShardPath } from "../Shard.js";
import type { ObservedPortal } from "../Portal.js";
import type { Statistics, WaveState } from "../Site.js";
import type { PortalId } from "../../common/Identifiers.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";

export class StatisticsCalculator {
    constructor(
        private readonly shards: Map<number, Shard>,
        private readonly portals: Record<PortalId, ObservedPortal>,
        private readonly paths: Record<string, ShardPath>
    ) {}

    public calculate(wave: ShardWaveTimeline): Statistics {
        const waveEndLimit = wave.shardsActions?.some(a => a.action === "despawn") ? wave.end + 55000 : wave.end;
        let moving = 0;
        let nonMoving = 0;
        let links = 0;

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

            links += waveHistory.filter(h => h.action === "link").length;
        }

        const wavePathCount = Object.values(this.paths).filter(path =>
            path.links.some(link => link.moves.some(m => m.moveTime >= wave.start && m.moveTime <= waveEndLimit))
        ).length;

        const targetsCount = Object.values(this.portals).filter(p => p.history?.some(h => {
            if (h.type !== "target") return false;
            return h.timestamp >= wave.start && h.timestamp <= wave.end;
        })).length;

        return {
            shards: {
                moving,
                nonMoving
            },
            links,
            paths: wavePathCount,
            ...(targetsCount > 0 && { targets: targetsCount })
        };
    }

    public aggregate(waveStates: Record<number, WaveState>): Statistics | undefined {
        const waveEntries = Object.values(waveStates);
        if (waveEntries.length <= 1) {
            return undefined;
        }

        let totalMoving = 0;
        let totalNonMoving = 0;
        let totalLinks = 0;
        let totalTargets = 0;

        for (const ws of waveEntries) {
            totalMoving += ws.statistics.shards.moving;
            totalNonMoving += ws.statistics.shards.nonMoving;
            totalLinks += ws.statistics.links;
            if (ws.statistics.targets) {
                totalTargets += ws.statistics.targets;
            }
        }

        return {
            shards: {
                moving: totalMoving,
                nonMoving: totalNonMoving
            },
            links: totalLinks,
            paths: Object.keys(this.paths).length,
            ...(totalTargets > 0 && { targets: totalTargets })
        };
    }
}
