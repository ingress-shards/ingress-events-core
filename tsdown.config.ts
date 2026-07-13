import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm"],
    dts: true,
    clean: true,
    bundle: false,
    copy: [
        { from: "conf/*", to: "dist/conf" },
        { from: "gen/conf/*", to: "dist/conf" },
        { from: "gen/conf/recent/*", to: "dist/conf/recent" },
        { from: "src/visuals/**/*.css", to: "dist/visuals" },
    ],
});
