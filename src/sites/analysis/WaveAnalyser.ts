import type { WaveState } from "../Site.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";
import type { ShardJumpWindowBuilder } from "./ShardJumpWindowBuilder.js";
import type { StatisticsCalculator } from "./StatisticsCalculator.js";
import type { DiagnosticsCalculator } from "./DiagnosticsCalculator.js";

export class WaveAnalyser {
    constructor(
        private readonly jumpWindowBuilder: ShardJumpWindowBuilder,
        private readonly statisticsCalculator: StatisticsCalculator,
        private readonly diagnosticsCalculator: DiagnosticsCalculator
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

            const statistics = this.statisticsCalculator.calculate(wave);
            const diagnostics = this.diagnosticsCalculator.calculate(wave);

            waveStates[wave.waveNumber] = {
                points,
                shardJumpWindows,
                statistics,
                ...(diagnostics && { diagnostics })
            };
        }

        return waveStates;
    }
}
