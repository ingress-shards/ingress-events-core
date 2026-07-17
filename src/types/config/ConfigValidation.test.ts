import { describe, test, expect } from "vitest";
import { z } from "zod";
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

describe("Strict Configuration Validation", () => {
    test("season_manifest.json matches exactly", () => {
        const result = seasonManifestSchema.strict().safeParse(manifestJson);
        if (!result.success) {
            console.error(JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        expect(result.success).toBe(true);
    });

    test("event_blueprints.json matches exactly", () => {
        const result = eventBlueprintsSchema
            .strict()
            // Every ornament must have at least one tag
            .refine(
                (data) => {
                    const blueprints = data as EventBlueprints;
                    return Object.values(blueprints.ornaments).every((o) => o.tags.length > 0);
                },
                {
                    message: "Every ornament must have at least one categorization tag.",
                },
            )
            // We must have coverage for the core mechanics
            .refine(
                (data) => {
                    const blueprints = data as EventBlueprints;
                    const activeTags = new Set<string>();
                    Object.values(blueprints.ornaments).forEach((o) => {
                        o.tags.forEach((tag) => activeTags.add(tag));
                    });

                    const required = ["target", "battle-beacon", "pre-event"];
                    return required.every((tag) => activeTags.has(tag));
                },
                {
                    message: "Blueprints must provide coverage for target, battle-beacon, and pre-event tags.",
                },
            )
            .safeParse(blueprintsJson);

        if (!result.success) {
            console.error(JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        expect(result.success).toBe(true);
    });

    test("dist/conf/season_geocode.json matches exactly", () => {
        const result = seasonGeocodeSchema.safeParse(geocodeJson);
        if (!result.success) {
            console.error(JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        expect(result.success).toBe(true);
    });

    test("dist/conf/recent/season_geocode.json matches exactly", () => {
        const result = seasonGeocodeSchema.safeParse(recentGeocodeJson);
        if (!result.success) {
            console.error(JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        expect(result.success).toBe(true);
    });

    test("dist/conf/recent/season_manifest.json matches exactly", () => {
        const result = seasonManifestSchema.strict().safeParse(recentManifestJson);
        if (!result.success) {
            console.error(JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        expect(result.success).toBe(true);
    });
});
