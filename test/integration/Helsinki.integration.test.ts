import { describe, it, expect } from "vitest";
import { SiteRecordAnalyser } from "../../src/sites/analysis/SiteRecordAnalyser.js";
import type { SiteRecord } from "../../src/sites/Site.js";
import { EventConfigRegistry } from "../../src/config/EventConfigRegistry.js";
import * as fs from "node:fs";
import path from "node:path";

import realBlueprints from "../../conf/event_blueprints.json" with { type: "json" };
import realManifest from "../../conf/season_manifest.json" with { type: "json" };
import realGeocode from "../../gen/conf/season_geocode.json" with { type: "json" };

describe("Helsinki Integration Analysis", () => {
    it("should verify real-world integration analysis on Helsinki site record using real registry", () => {
        const fixturePath = path.join(__dirname, "../fixtures/real-site-record.json");
        if (!fs.existsSync(fixturePath)) {
            console.warn("Skipping real-world integration test: real-site-record.json fixture not found.");
            return;
        }

        const rawData = fs.readFileSync(fixturePath, "utf8");
        const record = JSON.parse(rawData) as SiteRecord;

        const registry = new EventConfigRegistry(
            realBlueprints as any,
            realManifest as any,
            realGeocode as any
        );

        const helsinkiConfig = registry.getSiteConfig("2026-apollo-helsinki");
        expect(helsinkiConfig).toBeDefined();

        const analyser = new SiteRecordAnalyser(registry);
        const analysis = analyser.analyse(record);
        
        expect(analysis.centroid).toBeDefined();
        expect(analysis.centroid!.latE6).toBeGreaterThan(0);
        expect(analysis.centroid!.lngE6).toBeGreaterThan(0);
        
        // Assertions on the timeline/waves
        expect(Object.keys(analysis.waves).length).toBe(6);
        
        expect(analysis.shardPaths).toBeDefined();

        // checks the number of unscored link alignments - in this case, one link is neutral
        if (analysis.shardPaths) {
            let mismatchCount = 0;

            for (const pathKey of Object.keys(analysis.shardPaths)) {
                const path = analysis.shardPaths[pathKey];
                if (!path) continue;
                for (const link of path.links) {
                    for (const move of link.moves) {
                        if (move.mismatch) {
                            mismatchCount++;
                        }
                    }
                }
            }
            expect(mismatchCount).toBe(3);
        }

        // Assertions on site-wide statistics
        expect(analysis.statistics).toBeDefined();
        expect(analysis.statistics!.shards.moving).toBe(137);
        expect(analysis.statistics!.shards.nonMoving).toBe(1);
        expect(analysis.statistics!.links).toBe(425);
        expect(analysis.statistics!.paths).toBe(373);
        expect(analysis.statistics!.targets).toBe(72);
        
        // Assertions on diagnostics
        expect(analysis.diagnostics).toBeDefined();
        expect(analysis.diagnostics!.linkAlignmentMismatches).toEqual({ ENL: 2 });
        expect(analysis.waves[3]?.diagnostics?.linkAlignmentMismatches).toEqual({ ENL: 1 });
        expect(analysis.waves[5]?.diagnostics?.linkAlignmentMismatches).toEqual({ ENL: 1 });
        expect(analysis.waves[1]?.diagnostics).toBeUndefined();
        
        // Assertions on final scoring
        expect(analysis.seasonPointsResult).toBeDefined();
        expect(analysis.seasonPointsResult!.points.RES).toBe(82.1);
        expect(analysis.seasonPointsResult!.points.ENL).toBe(17.9);
        expect(analysis.seasonPointsResult!.contributingWaves?.RES).toEqual([1, 4, 5]);
        expect(analysis.seasonPointsResult!.contributingWaves?.ENL).toEqual([2, 3, 6]);

        expect(analysis.shardPaths).toBeDefined();
    }, 15000);
});
