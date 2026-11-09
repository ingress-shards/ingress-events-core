import { describe, it, expect } from "vitest";
import { SeasonPointsCalculator } from "./SeasonPointsCalculator.js";
import type { WaveState } from "../../sites/Site.js";
import type { SiteTimeline } from "../../config/SiteConfig.js";

const createMockWaveState = (resistancePoints: number, enlightenedPoints: number): WaveState => ({
    points: {
        total: { RES: resistancePoints, ENL: enlightenedPoints },
        links: { RES: resistancePoints, ENL: enlightenedPoints }
    },
    shardJumpWindows: []
});

describe("SeasonPointsCalculator", () => {

    it("should return undefined when seasonPointsTotal is not provided", () => {
        const calculator = new SeasonPointsCalculator();
        const result = calculator.calculate({}, {});
        expect(result).toBeUndefined();
    });

    it("should proportionally distribute season points based on raw scores across all waves", () => {
        const calculator = new SeasonPointsCalculator();
        const waveStates: Record<number, WaveState> = {
            1: createMockWaveState(10, 0),
            2: createMockWaveState(0, 10)
        };

        const result = calculator.calculate(waveStates, { seasonPointsTotal: 6 });
        expect(result).toBeDefined();
        // 10 RES vs 10 ENL -> 50/50 split of 6 points = 3.0 each
        expect(result!.points.RES).toBe(3);
        expect(result!.points.ENL).toBe(3);
        expect(result!.contributingWaves?.RES).toEqual([1]);
        expect(result!.contributingWaves?.ENL).toEqual([2]);
    });

    it("should handle wavePointAggregation max-rule groups", () => {
        const calculator = new SeasonPointsCalculator();
        // Wave 1 & 2 in group 1, Wave 3 & 4 in group 2
        const waveStates: Record<number, WaveState> = {
            1: createMockWaveState(5, 2),
            2: createMockWaveState(10, 1), // best RES in group 1 is wave 2 (10)
            3: createMockWaveState(2, 8),
            4: createMockWaveState(1, 4)   // best ENL in group 2 is wave 3 (8)
        };

        const timeline: SiteTimeline = {
            start: 1000,
            preEventCutoff: 500,
            end: 5000,
            durationMinutes: 60,
            shards: [
                { waveNumber: 1, start: 1000, end: 2000, expectedShards: 5 },
                { waveNumber: 2, start: 2000, end: 3000, expectedShards: 5 },
                { waveNumber: 3, start: 3000, end: 4000, expectedShards: 5 },
                { waveNumber: 4, start: 4000, end: 5000, expectedShards: 5 }
            ]
        };

        // Group 1: waves 1, 2. Max RES = 10 (wave 2), Max ENL = 2 (wave 1)
        // Group 2: waves 3, 4. Max RES = 2 (wave 3), Max ENL = 8 (wave 3)
        // Raw RES = 10 + 2 = 12. Raw ENL = 2 + 8 = 10. Total raw = 22.
        const result = calculator.calculate(
            waveStates,
            {
                seasonPointsTotal: 10,
                wavePointAggregation: [[1, 2], [3, 4]]
            },
            timeline
        );

        expect(result).toBeDefined();
        // RES: (10 * 12) / 22 = 5.4545... -> 5.5
        // ENL: (10 * 10) / 22 = 4.5454... -> 4.5
        expect(result!.points.RES).toBe(5.5);
        expect(result!.points.ENL).toBe(4.5);
        expect(result!.contributingWaves?.RES).toEqual([2, 3]);
        expect(result!.contributingWaves?.ENL).toEqual([1, 3]);
    });

    it("should handle 0 raw points scored gracefully", () => {
        const calculator = new SeasonPointsCalculator();
        const waveStates: Record<number, WaveState> = {
            1: createMockWaveState(0, 0)
        };

        const result = calculator.calculate(waveStates, { seasonPointsTotal: 6 });
        expect(result).toBeDefined();
        expect(result!.points.RES).toBeUndefined();
        expect(result!.points.ENL).toBeUndefined();
        expect(result!.contributingWaves).toBeUndefined();
    });
});
