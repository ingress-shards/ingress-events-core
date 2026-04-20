import { describe, test, expect } from "vitest";
import { z } from "zod";
import manifestJson from "../../conf/season_manifest.json" with { type: "json" };
import blueprintsJson from "../../conf/event_blueprints.json" with { type: "json" };
import geocodeJson from "../../dist/conf/season_geocode.json" with { type: "json" };
import recentGeocodeJson from "../../dist/conf/recent/season_geocode.json" with { type: "json" };
import recentManifestJson from "../../dist/conf/recent/season_manifest.json" with { type: "json" };

// Import the batch-generated Zod schemas from gen/types/
import { seasonManifestSchema } from "../../gen/zod-schemas/Manifest.zod.js";
import { eventBlueprintsSchema } from "../../gen/zod-schemas/EventBlueprints.zod.js";
import { seasonGeocodeSchema } from "../../gen/zod-schemas/Geocode.zod.js";

describe("Strict Configuration Validation", () => {
    test("season_manifest.json matches exactly", () => {
        const result = seasonManifestSchema.strict().safeParse(manifestJson);
        if (!result.success) {
            console.error(JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        expect(result.success).toBe(true);
    });

    test("event_blueprints.json matches exactly", () => {
        const result = eventBlueprintsSchema.strict().safeParse(blueprintsJson);
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
