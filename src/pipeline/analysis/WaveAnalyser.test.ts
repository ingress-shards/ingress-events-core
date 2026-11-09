import { describe, it, expect, vi } from "vitest";
import { WaveAnalyser } from "./WaveAnalyser.js";
import type { ShardJumpWindowBuilder } from "./ShardJumpWindowBuilder.js";
import type { StatisticsCalculator } from "./StatisticsCalculator.js";
import type { ShardWaveTimeline } from "../../config/SiteConfig.js";

describe("WaveAnalyser", () => {
    const wave1: ShardWaveTimeline = {
        waveNumber: 1,
        start: 1000,
        end: 2000,
        expectedShards: 5,
        shardsActions: [{ action: "jump", time: 1500 }]
    };

    const wave2Empty: ShardWaveTimeline = {
        waveNumber: 2,
        start: 2000,
        end: 3000,
        expectedShards: 5,
        shardsActions: [{ action: "despawn", time: 2500 }]
    };

    it("should assemble WaveStates across waves and short-circuit empty waves", () => {
        const mockWindows = [
            {
                scheduledStart: 1500,
                actualEnd: 1500,
                jumpNumber: 1,
                actionCount: 1,
                points: { total: { RES: 2 } }
            }
        ];
        const mockPoints = {
            total: { RES: 2 },
            links: { RES: 2 }
        };
        const mockWaveStats = {
            shards: { moving: 1, nonMoving: 4 },
            links: 1,
            paths: 1
        };

        const mockJumpWindowBuilder = {
            buildWaveWindows: vi.fn()
                .mockReturnValueOnce({ shardJumpWindows: mockWindows, points: mockPoints })
                .mockReturnValueOnce({ shardJumpWindows: [], points: {} })
        } as unknown as ShardJumpWindowBuilder;

        const mockStatsCalculator = {
            calculateWaveStatistics: vi.fn().mockReturnValue(mockWaveStats)
        } as unknown as StatisticsCalculator;

        const analyser = new WaveAnalyser(mockJumpWindowBuilder, mockStatsCalculator);

        const waveStates = analyser.analyse([wave1, wave2Empty]);

        expect(mockJumpWindowBuilder.buildWaveWindows).toHaveBeenCalledTimes(2);
        expect(mockStatsCalculator.calculateWaveStatistics).toHaveBeenCalledWith(wave1);

        expect(Object.keys(waveStates)).toEqual(["1"]);
        expect(waveStates[1]).toEqual({
            points: mockPoints,
            shardJumpWindows: mockWindows,
            statistics: mockWaveStats
        });
    });
});
