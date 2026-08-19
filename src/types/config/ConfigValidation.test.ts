import { describe, test, expect } from "vitest";
import manifestJson from "../../../conf/season_manifest.json" with { type: "json" };
import blueprintsJson from "../../../conf/event_blueprints.json" with { type: "json" };
import geocodeJson from "../../../gen/conf/season_geocode.json" with { type: "json" };
import recentGeocodeJson from "../../../gen/conf/recent/season_geocode.json" with { type: "json" };
import recentManifestJson from "../../../gen/conf/recent/season_manifest.json" with { type: "json" };

// Import the batch-generated Zod schemas from gen/types/
import { seasonManifestSchema } from "../../../gen/zod-schemas/Manifest.zod.js";
import { eventBlueprintsSchema } from "../../../gen/zod-schemas/EventBlueprints.zod.js";
import { seasonGeocodeSchema } from "../../../gen/zod-schemas/Geocode.zod.js";
import type { EventBlueprints } from "./EventBlueprints.js";

const getValidationContext = () => {
    const blueprintsResult = eventBlueprintsSchema.safeParse(blueprintsJson);
    const manifestResult = seasonManifestSchema.safeParse(manifestJson);
    const geocodeResult = seasonGeocodeSchema.safeParse(geocodeJson);
    const recentGeocodeResult = seasonGeocodeSchema.safeParse(recentGeocodeJson);

    expect(blueprintsResult.error?.issues, "blueprintsJson Zod schema mismatch").toBeUndefined();
    expect(manifestResult.error?.issues, "manifestJson Zod schema mismatch").toBeUndefined();
    expect(geocodeResult.error?.issues, "geocodeJson Zod schema mismatch").toBeUndefined();
    expect(recentGeocodeResult.error?.issues, "recentGeocodeJson Zod schema mismatch").toBeUndefined();

    const blueprints = blueprintsResult.data as EventBlueprints;
    const manifest = manifestResult.data!;
    const geocode = geocodeResult.data!;
    const recentGeocode = recentGeocodeResult.data!;

    return {
        blueprints,
        manifest,
        geocode,
        recentGeocode,
        validEventTypes: new Set(Object.keys(blueprints.events)),
        validShardMechanics: new Set(Object.keys(blueprints.shardMechanics)),
        validTargetMechanics: new Set(Object.keys(blueprints.targetMechanics)),
        validOrnaments: new Set(Object.keys(blueprints.ornaments))
    };
}

describe("Strict Configuration Validation", () => {
    test("season_manifest.json matches exactly", () => {
        const result = seasonManifestSchema.safeParse(manifestJson);
        expect(result.error?.issues).toBeUndefined();
    });

    test("event_blueprints.json matches exactly", () => {
        const result = eventBlueprintsSchema
            // Every ornament must have at least one tag
            .refine(
                (data: unknown) => {
                    const blueprints = data as EventBlueprints;
                    return Object.values(blueprints.ornaments).every((o) => o.tags.length > 0);
                },
                {
                    message: "Every ornament must have at least one categorization tag.",
                },
            )
            // We must have coverage for the core mechanics
            .refine(
                (data: unknown) => {
                    const blueprints = data as EventBlueprints;
                    const activeTags = new Set<string>();
                    for (const o of Object.values(blueprints.ornaments)) {
                        for (const tag of o.tags) {
                            activeTags.add(tag);
                        }
                    }

                    const required = ["target", "battle-beacon", "pre-event"];
                    return required.every((tag) => activeTags.has(tag));
                },
                {
                    message: "Blueprints must provide coverage for target, battle-beacon, and pre-event tags.",
                },
            )
            .safeParse(blueprintsJson);

        expect(result.error?.issues).toBeUndefined();
    });

    test("dist/conf/season_geocode.json matches exactly", () => {
        const result = seasonGeocodeSchema.safeParse(geocodeJson);
        expect(result.error?.issues).toBeUndefined();
    });

    test("dist/conf/recent/season_geocode.json matches exactly", () => {
        const result = seasonGeocodeSchema.safeParse(recentGeocodeJson);
        expect(result.error?.issues).toBeUndefined();
    });

    test("dist/conf/recent/season_manifest.json matches exactly", () => {
        const result = seasonManifestSchema.safeParse(recentManifestJson);
        expect(result.error?.issues).toBeUndefined();
    });

    test("all referenced event types exist in blueprints", () => {
        const context = getValidationContext();
        
        // Manifest components event types
        for (const season of context.manifest.seasons) {
            for (const component of season.components) {
                expect(context.validEventTypes, `Season "${season.id}" component eventType "${component.eventType}"`).toContain(component.eventType);
            }
        }

        // Geocode seasons site event types
        for (const season of context.geocode.seasons) {
            for (const site of season.sites) {
                expect(context.validEventTypes, `Geocode season "${season.id}" site eventType "${site.eventType}"`).toContain(site.eventType);
            }
        }
        for (const season of context.recentGeocode.seasons) {
            for (const site of season.sites) {
                expect(context.validEventTypes, `Recent geocode season "${season.id}" site eventType "${site.eventType}"`).toContain(site.eventType);
            }
        }
    });

    test("all referenced shard mechanics exist in blueprints", () => {
        const context = getValidationContext();

        for (const season of context.manifest.seasons) {
            for (const component of season.components) {
                const shards = component.mechanics.shards;
                if (shards) {
                    expect(context.validShardMechanics, `Season "${season.id}" component "${component.eventType}" shardMechanics "${shards.shardMechanics}"`).toContain(shards.shardMechanics);
                }
            }
        }
    });

    test("all referenced target mechanics exist in blueprints", () => {
        const context = getValidationContext();

        for (const season of context.manifest.seasons) {
            for (const component of season.components) {
                const shards = component.mechanics.shards;
                if (shards?.targetMechanics) {
                    expect(context.validTargetMechanics, `Season "${season.id}" component "${component.eventType}" targetMechanics "${shards.targetMechanics}"`).toContain(shards.targetMechanics);
                }
            }
        }
    });


    test("all ornaments referenced in blueprints conditions exist in blueprints ornaments list", () => {
        const context = getValidationContext();

        if (context.blueprints.linkScoringRules) {
            for (const [ruleId, rule] of Object.entries(context.blueprints.linkScoringRules)) {
                const ornaments = rule.conditions?.ornaments;
                if (ornaments) {
                    for (const ornament of ornaments) {
                        expect(context.validOrnaments, `Blueprint link scoring rule "${ruleId}" referenced ornament "${ornament}"`).toContain(ornament);
                    }
                }
            }
        }

        if (context.blueprints.goalScoringRules) {
            for (const [ruleId, rule] of Object.entries(context.blueprints.goalScoringRules)) {
                const ornaments = (rule.conditions as any)?.ornaments; // Cast just in case it exists for goals
                if (ornaments) {
                    for (const ornament of ornaments) {
                        expect(context.validOrnaments, `Blueprint goal scoring rule "${ruleId}" referenced ornament "${ornament}"`).toContain(ornament);
                    }
                }
            }
        }
    });
});
