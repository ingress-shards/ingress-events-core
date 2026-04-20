import { describe, it, expect } from "vitest";
import { z } from "zod";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { shardJumpCaptureSchema } from "../../gen/zod-schemas/ShardJumps.zod.js";

const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
const testDataDirectory = path.join(currentFileDirectory, "test-data");
const files = readdirSync(testDataDirectory).filter(f => f.endsWith(".json"));

describe("Shard Jump Schema Validation - Real World Data", () => {
    it.each(files)("validates %s matches the schema exactly", (filename) => {
        const filePath = path.join(testDataDirectory, filename);
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        
        const result = shardJumpCaptureSchema.strict().safeParse(content);
        
        if (!result.success) {
            // Provide detail on exactly where the schema mismatch is
            console.error(`Validation failed for ${filename}:`, JSON.stringify(z.treeifyError(result.error), undefined, 2));
        }
        
        expect(result.success).toBe(true);
    });
});
