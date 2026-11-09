import type { WaveState } from "../../sites/Site.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";
import type { ShardJumpWindowBuilder } from "./ShardJumpWindowBuilder.js";
import type { StatisticsCalculator } from "./StatisticsCalculator.js";

export class WaveAnalyser {
    constructor(
        private readonly jumpWindowBuilder: ShardJumpWindowBuilder,
        private readonly statisticsCalculator?: StatisticsCalculator
    ) {}

    public analyse(waves?: ShardWaveTimeline[]): Record<number, WaveState> {
        const waveStates: Record<number, WaveState> = {};
        if (!waves) {
            return waveStates;
        }

        for (const wave of waves) {
            const { shardJumpWindows, points } = this.jumpWindowBuilder.buildWaveWindows(wave);
            if (shardJumpWindows.length === 0) {
                continue;
            }

            const statistics = this.statisticsCalculator?.calculateWaveStatistics(wave);

            waveStates[wave.waveNumber] = {
                points,
                shardJumpWindows,
                ...(statistics && { statistics }),
            };
        }

        return waveStates;
    }
}
