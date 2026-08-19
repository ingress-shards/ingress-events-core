 
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true, // Required for suite discovery on some Windows environments
        environment: "node",
        include: ["src/**/*.test.ts", "test/**/*.test.ts"],
        exclude: ["node_modules", "dist"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/index.ts",
                "src/gen/**",
                "node_modules/**",
                "dist/**",
            ],
            reporter: ["text"],
        },
    },
});
