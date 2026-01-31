/* eslint-disable unicorn/filename-case */
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true, // Required for suite discovery on some Windows environments
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["node_modules", "dist"],
    },
});
