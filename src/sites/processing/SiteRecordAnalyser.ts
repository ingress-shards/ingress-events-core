import type { SiteRecord, SiteAnalysis, WaveState, Points, Statistics, SeasonPointsResult } from "../Site.js";
import type { Shard, ShardMove, Link, ShardPath } from "../Shard.js";
import { calculateCentroid } from "../../common/Geo.js";
import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";
import type { FactionId } from "../../common/Factions.js";
import { roundToDecimalPlaces } from "../../common/Math.js";
import { LinkScoringEngine } from "./LinkScoringEngine.js";
import { ShardPathBuilder } from "./ShardPathBuilder.js";
import { WaveAnalyser } from "./WaveAnalyser.js";

export const SiteRecordAnalyser = {
    analyze: (record: SiteRecord, config?: EventConfigRegistry): SiteAnalysis => {
        console.log(`[Site Observer: Site Record Analysis] Analysing site ${record.metadata.siteId}`);
        
        const portals = record.observations?.portals ? Object.values(record.observations.portals) : [];
        const shardEntries = record.observations?.shards ? Object.entries(record.observations.shards) : [];
        const shards = new Map<number, Shard>(shardEntries.map(([id, s]) => [Number(id), s]));
        const portalsMap = record.observations?.portals ?? {};

        // 1. Core aggregates
        const portalCoordinates = portals.map(p => ({ latE6: p.latE6, lngE6: p.lngE6 }));
        const centroid = calculateCentroid(portalCoordinates);
        const hasPreEventOrnaments = portals.some(p => p.history?.some(h => h.type === "pre-event"));

        // 2. Scoring rules & config
        const siteConfig = config?.getSiteConfig(record.metadata.siteId);
        const timeline = siteConfig?.timeline;
        const linkScoringRules = siteConfig?.mechanics?.shards?.scoring?.linkScoringRules ?? {};
        const goalScoringRules = siteConfig?.mechanics?.shards?.scoring?.goalScoringRules ?? {};

        // 3. Build overall shard paths (and score them simultaneously if timeline is available)
        let linkScorer: undefined | ((move: ShardMove, link: Link, path: ShardPath) => string[]);
        if (timeline) {
            linkScorer = LinkScoringEngine.createScorer(linkScoringRules, portalsMap, timeline);
        }

        const overallShardPaths = ShardPathBuilder.buildShardPaths(shardEntries, portalsMap, linkScorer);

        // 4. Calculate Wave Snapshots
        const waveStates: Record<number, WaveState> = {};
        if (timeline?.shards) {
            for (const wave of timeline.shards) {
                const ws = WaveAnalyser.buildWaveState(
                    wave.waveNumber,
                    wave,
                    shards,
                    portalsMap,
                    overallShardPaths,
                    goalScoringRules,
                    linkScoringRules,
                    timeline
                );
                if (ws.shardActionWindows.length > 0) {
                    waveStates[wave.waveNumber] = ws;
                }
            }
        }

        // 5. Aggregate Wave scores to get Season Points
        const rawScores: Record<FactionId, number> = { RES: 0, ENL: 0, MAC: 0, NEU: 0 };
        const contributingWaves: Partial<Record<FactionId, number[]>> = { RES: [], ENL: [] };
        const wavePointAggregation = siteConfig?.mechanics?.shards?.scoring?.wavePointAggregation;

        if (wavePointAggregation && timeline?.shards) {
            for (const group of wavePointAggregation) {
                let maxRES = 0, maxENL = 0;
                let bestResistanceWave = -1, bestEnlightenedWave = -1;
                for (const waveNum of group) {
                    const ws = waveStates[waveNum];
                    if (ws) {
                        const resistancePoints = ws.points.total.RES ?? 0;
                        const enlightenedPoints = ws.points.total.ENL ?? 0;
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
                const resistancePoints = ws.points.total.RES ?? 0;
                const enlightenedPoints = ws.points.total.ENL ?? 0;
                rawScores.RES += resistancePoints;
                rawScores.ENL += enlightenedPoints;
                if (resistancePoints > 0) contributingWaves.RES!.push(waveNumber);
                if (enlightenedPoints > 0) contributingWaves.ENL!.push(waveNumber);
            }
        }

        const seasonPointsTotal = siteConfig?.mechanics?.shards?.scoring?.seasonPoints;
        const finalPoints: Points = {};
        let seasonPointsResult: SeasonPointsResult | undefined;

        if (seasonPointsTotal !== undefined) {
            const totalRaw = rawScores.RES + rawScores.ENL;
            if (totalRaw > 0) {
                const resistancePoints = roundToDecimalPlaces((seasonPointsTotal * rawScores.RES) / totalRaw, 1);
                const enlightenedPoints = roundToDecimalPlaces((seasonPointsTotal * rawScores.ENL) / totalRaw, 1);
                if (resistancePoints > 0) finalPoints.RES = resistancePoints;
                if (enlightenedPoints > 0) finalPoints.ENL = enlightenedPoints;
            }
            
            seasonPointsResult = {
                points: finalPoints,
                ...((contributingWaves.RES!.length > 0 || contributingWaves.ENL!.length > 0) && { contributingWaves })
            };
        }

        // 6. Aggregate Site-wide statistics for multi-wave events
        let siteStatistics: Statistics | undefined;
        if (timeline?.shards && timeline.shards.length > 1) {
            const counters = { moving: 0, nonMoving: 0, links: 0 };
            const fullWaveWindow = { start: timeline.shards[0]!.start, end: timeline.shards.at(-1)!.end };
            WaveAnalyser.countWaveShardMovement(shards, fullWaveWindow, counters);

            siteStatistics = {
                shards: {
                    moving: counters.moving,
                    nonMoving: counters.nonMoving
                },
                links: counters.links,
                paths: Object.keys(overallShardPaths).length,
                linkAlignmentMismatch: ShardPathBuilder.countLinkAlignmentMismatches(overallShardPaths),
                targetsCount: portals.filter(p => p.history?.some(h => h.type === "target")).length
            };
        }

        return {
            ...(centroid && { centroid }),
            ...(seasonPointsResult && { seasonPoints: seasonPointsResult }),
            hasPreEventOrnaments,
            waves: waveStates,
            siteShardPaths: overallShardPaths,
            ...(siteStatistics && { siteStatistics })
        };
    }
};
