import type { SiteRecord, SiteAnalysis } from "../../sites/Site.js";
import type { Shard } from "../../sites/Shard.js";
import { calculateCentroid } from "../../common/Geo.js";
import type { EventConfigRegistry } from "../../config/EventConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import { LinkScoringEngine } from "./LinkScoringEngine.js";
import { TargetScoringEngine } from "./TargetScoringEngine.js";
import { ShardPathBuilder } from "./ShardPathBuilder.js";
import { ShardJumpWindowBuilder } from "./ShardJumpWindowBuilder.js";
import { WaveAnalyser } from "./WaveAnalyser.js";
import { SeasonPointsCalculator } from "./SeasonPointsCalculator.js";
import { StatisticsCalculator } from "./StatisticsCalculator.js";
import { DiagnosticsCalculator } from "./DiagnosticsCalculator.js";
import type { ShardLinkScoringRule, ShardGoalScoringRule } from "../../types/config/EventBlueprints.js";

interface SiteScoringContext {
    linkRules: Record<string, ShardLinkScoringRule>;
    goalRules: Record<string, ShardGoalScoringRule>;
    wavePointAggregation?: number[][] | undefined;
    seasonPointsTotal?: number | undefined;
}

export class SiteRecordAnalyser {
    constructor(private readonly registry: EventConfigRegistry) {}

    private resolveScoringContext(siteConfig?: SiteConfig): SiteScoringContext {
        const linkRules: Record<string, ShardLinkScoringRule> = {};
        const goalRules: Record<string, ShardGoalScoringRule> = {};
        let wavePointAggregation: number[][] | undefined;
        let seasonPointsTotal: number | undefined;

        if (siteConfig && this.registry) {
            const season = this.registry.getSeasonMetadata(siteConfig.seasonId);
            const component = season?.components?.find(c => c.eventType === siteConfig.geocode?.eventType);
            const scoring = component?.mechanics?.shards?.scoring;
            if (scoring) {
                wavePointAggregation = scoring.wavePointAggregation;
                seasonPointsTotal = scoring.seasonPoints;
                if (scoring.linkRules) {
                    for (const ruleId of scoring.linkRules) {
                        const rule = this.registry.blueprints?.linkScoringRules?.[ruleId];
                        if (rule) linkRules[ruleId] = rule;
                    }
                }
                if (scoring.goalRules) {
                    for (const ruleId of scoring.goalRules) {
                        const rule = this.registry.blueprints?.goalScoringRules?.[ruleId];
                        if (rule) goalRules[ruleId] = rule;
                    }
                }
            }
        }

        return { linkRules, goalRules, wavePointAggregation, seasonPointsTotal };
    }

    public analyse(record: SiteRecord): SiteAnalysis {
        console.log(`[Site Observer: Site Record Analysis] Analysing site ${record.metadata.siteId}`);
        
        const portals = record.observations?.portals ? Object.values(record.observations.portals) : [];
        const shards = new Map<number, Shard>(
            record.observations?.shards
                ? Object.entries(record.observations.shards).map(([id, s]) => [Number(id), s])
                : []
        );
        const portalsMap = record.observations?.portals ?? {};

        // 1. Core aggregates
        const centroid = calculateCentroid(portals);

        // 2. Scoring rules & config
        const siteConfig = this.registry?.getSiteConfig(record.metadata.siteId);
        const timeline = siteConfig?.timeline;
        const scoringContext = this.resolveScoringContext(siteConfig);

        // 3. Build overall shard paths & score them
        const shardPaths = new ShardPathBuilder().build(shards, portalsMap);
        if (timeline) {
            new LinkScoringEngine(scoringContext.linkRules, portalsMap, timeline).scorePaths(shardPaths);
        }

        // 4. Instantiate domain services & calculators
        const targetScorer = new TargetScoringEngine(scoringContext.goalRules, timeline, shards, portalsMap);
        const jumpWindowBuilder = new ShardJumpWindowBuilder(targetScorer, shards, shardPaths);
        const statisticsCalculator = new StatisticsCalculator(shards, portalsMap, shardPaths);
        const diagnosticsCalculator = new DiagnosticsCalculator(shards, portalsMap, shardPaths);
        const waveAnalyser = new WaveAnalyser(jumpWindowBuilder, statisticsCalculator, diagnosticsCalculator);

        // 5. Calculate Wave Snapshots
        const waveStates = waveAnalyser.analyse(timeline?.shards);

        // 6. Aggregate Wave scores to get Season Points
        const seasonPointsResult = new SeasonPointsCalculator().calculate(waveStates, scoringContext, timeline);

        // 7. Aggregate Site-wide statistics and diagnostics for multi-wave events
        const statistics = statisticsCalculator.aggregate(waveStates);
        const diagnostics = diagnosticsCalculator.aggregate(waveStates);

        return {
            ...(centroid && { centroid }),
            waves: waveStates,
            shardPaths,
            ...(statistics && { statistics }),
            ...(seasonPointsResult && { seasonPointsResult }),
            ...(diagnostics && { diagnostics })
        };
    }
}
