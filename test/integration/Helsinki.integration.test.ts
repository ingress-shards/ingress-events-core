import { describe, it, expect } from "vitest";
import { SiteRecordAnalyser } from "../../src/sites/processing/SiteRecordAnalyser.js";
import type { SiteRecord } from "../../src/sites/Site.js";
import { EventConfigRegistry } from "../../src/config/EventConfigRegistry.js";
import * as fs from "node:fs";
import path from "node:path";

import realBlueprints from "../../conf/event_blueprints.json" with { type: "json" };
import realManifest from "../../conf/season_manifest.json" with { type: "json" };
import realGeocode from "../../gen/conf/recent/season_geocode.json" with { type: "json" };

describe("Helsinki Integration Analysis", () => {
    it("should verify real-world integration analysis on Helsinki site record using real registry", () => {
        const fixturePath = path.join(__dirname, "../fixtures/real-site-record.json");
        if (!fs.existsSync(fixturePath)) {
            console.warn("Skipping real-world integration test: real-site-record.json fixture not found.");
            return;
        }

        const rawData = fs.readFileSync(fixturePath, "utf8");
        const record = JSON.parse(rawData) as SiteRecord;

        const registry = new EventConfigRegistry({
            eventBlueprints: realBlueprints as any,
            seasonManifest: realManifest as any,
            seasonGeocode: realGeocode as any
        });

        const helsinkiConfig = registry.getSiteConfig("2026-apollo-helsinki");
        expect(helsinkiConfig).toBeDefined();

        const analysis = SiteRecordAnalyser.analyze(record, registry);
        
        expect(analysis.centroid).toBeDefined();
        expect(analysis.centroid!.latE6).toBeGreaterThan(0);
        expect(analysis.centroid!.lngE6).toBeGreaterThan(0);
        
        // Assertions on the timeline/waves
        expect(Object.keys(analysis.waves).length).toBe(6);
        
        expect(analysis.siteShardPaths).toBeDefined();

        // checks the number of unscored link alignments - in this case, one link is neutral
        if (analysis.siteShardPaths) {
            let mismatchCount = 0;

            for (const pathKey of Object.keys(analysis.siteShardPaths)) {
                const path = analysis.siteShardPaths[pathKey];
                for (const link of path.links) {
                    for (const move of link.moves) {
                        if (move.mismatch) {
                            console.log('Mismatch Move:', pathKey, move.moveTime, 'Scored:', move.scoredRules);
                            mismatchCount++;
                        }
                    }
                }
            }
            expect(mismatchCount).toBe(3);
        }

        // Assertions on site-wide statistics
        expect(analysis.siteStatistics).toBeDefined();
        expect(analysis.siteStatistics!.shards.moving).toBe(69);
        expect(analysis.siteStatistics!.shards.nonMoving).toBe(0);
        expect(analysis.siteStatistics!.links).toBe(425);
        expect(analysis.siteStatistics!.paths).toBe(373);
        expect(analysis.siteStatistics!.targetsCount).toBe(72);
        expect(analysis.siteStatistics!.linkAlignmentMismatch).toBe(2);
        
        // Assertions on final scoring
        expect(analysis.seasonPoints).toBeDefined();
        expect(analysis.seasonPoints!.points.RES).toBe(82.1);
        expect(analysis.seasonPoints!.points.ENL).toBe(17.9);
        expect(analysis.seasonPoints!.contributingWaves?.RES).toEqual([1, 4, 5]);
        expect(analysis.seasonPoints!.contributingWaves?.ENL).toEqual([2, 3, 6]);

        expect(analysis.siteShardPaths).toBeDefined();
    });
});
