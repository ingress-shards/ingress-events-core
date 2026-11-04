import type { WaveState } from "../../sites/Site.js";
import type { SeasonPointsResult, FactionPoints } from "../../sites/Scoring.js";
import type { FactionId } from "../../common/Alignment.js";
import type { SiteTimeline } from "../../config/SiteConfig.js";
import { roundToDecimalPlaces } from "../../common/Math.js";

export interface SeasonPointsConfig {
    seasonPointsTotal?: number | undefined;
    wavePointAggregation?: number[][] | undefined;
}

export class SeasonPointsCalculator {
    public calculate(
        waveStates: Record<number, WaveState>,
        config: SeasonPointsConfig,
        timeline?: SiteTimeline
    ): SeasonPointsResult | undefined {
        if (config.seasonPointsTotal === undefined) {
            return undefined;
        }

        const rawScores: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0 };
        const contributingWaves: Partial<Record<FactionId, number[]>> = { RES: [], ENL: [] };

        if (config.wavePointAggregation && timeline?.shards) {
            for (const group of config.wavePointAggregation) {
                let maxRES = 0;
                let maxENL = 0;
                let bestResistanceWave = -1;
                let bestEnlightenedWave = -1;

                for (const waveNum of group) {
                    const ws = waveStates[waveNum];
                    if (ws) {
                        const resistancePoints = ws.points.total?.RES ?? 0;
                        const enlightenedPoints = ws.points.total?.ENL ?? 0;
                        if (resistancePoints > maxRES) {
                            maxRES = resistancePoints;
                            bestResistanceWave = waveNum;
                        }
                        if (enlightenedPoints > maxENL) {
                            maxENL = enlightenedPoints;
                            bestEnlightenedWave = waveNum;
                        }
                    }
                }
                rawScores.RES += maxRES;
                rawScores.ENL += maxENL;
                if (bestResistanceWave !== -1) contributingWaves.RES!.push(bestResistanceWave);
                if (bestEnlightenedWave !== -1) contributingWaves.ENL!.push(bestEnlightenedWave);
            }
        } else {
            for (const [waveNum, ws] of Object.entries(waveStates)) {
                const waveNumber = Number(waveNum);
                const resistancePoints = ws.points.total?.RES ?? 0;
                const enlightenedPoints = ws.points.total?.ENL ?? 0;
                rawScores.RES += resistancePoints;
                rawScores.ENL += enlightenedPoints;
                if (resistancePoints > 0) contributingWaves.RES!.push(waveNumber);
                if (enlightenedPoints > 0) contributingWaves.ENL!.push(waveNumber);
            }
        }

        const finalPoints: FactionPoints = {};
        const totalRaw = rawScores.RES + rawScores.ENL;
        if (totalRaw > 0) {
            const resistancePoints = roundToDecimalPlaces((config.seasonPointsTotal * rawScores.RES) / totalRaw, 1);
            const enlightenedPoints = roundToDecimalPlaces((config.seasonPointsTotal * rawScores.ENL) / totalRaw, 1);
            if (resistancePoints > 0) finalPoints.RES = resistancePoints;
            if (enlightenedPoints > 0) finalPoints.ENL = enlightenedPoints;
        }

        return {
            points: finalPoints,
            ...((contributingWaves.RES!.length > 0 || contributingWaves.ENL!.length > 0) && { contributingWaves })
        };
    }
}
