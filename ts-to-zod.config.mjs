/**
 * ts-to-zod configuration file
 * @type {import('ts-to-zod').TsToZodConfig}
 */
export default [
    {
        name: "Factions",
        input: "src/common/Factions.ts",
        output: "gen/zod-schemas/Factions.zod.ts",
    },
    {
        name: "Geo",
        input: "src/common/Geo.ts",
        output: "gen/zod-schemas/Geo.zod.ts",
    },
    {
        name: "Identifiers",
        input: "src/common/Identifiers.ts",
        output: "gen/zod-schemas/Identifiers.zod.ts",
    },
    {
        name: "SeasonManifest",
        input: "src/types/config/Manifest.ts",
        output: "gen/zod-schemas/Manifest.zod.ts",
    },
    {
        name: "SeasonGeocode",
        input: "src/types/config/Geocode.ts",
        output: "gen/zod-schemas/Geocode.zod.ts",
    },
    {
        name: "EventBlueprints",
        input: "src/types/config/EventBlueprints.ts",
        output: "gen/zod-schemas/EventBlueprints.zod.ts",
    },
    {
        name: "SeasonEvent",
        input: "src/seasons/Season.ts",
        output: "gen/zod-schemas/SeasonEvent.zod.ts",
    },
    {
        name: "Portal",
        input: "src/sites/Portal.ts",
        output: "gen/zod-schemas/Portal.zod.ts",
    },
    {
        name: "Shard",
        input: "src/sites/Shard.ts",
        output: "gen/zod-schemas/Shard.zod.ts",
    },
    {
        name: "ShardJumps",
        input: "src/types/capture/ShardJumps.ts",
        output: "gen/zod-schemas/ShardJumps.zod.ts",
    }
];
