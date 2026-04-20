import type { SeasonConfig } from "./SeasonConfig.js";
import type { SeasonRecord } from "./Season.js";

export class SeasonDataProcessor {
    constructor(private seasonConfig: SeasonConfig) {}

    processSeason(): SeasonRecord {
        console.log("[SeasonDataProcessor] Processing season", this.seasonConfig.metadata.id);
        return {
            seasonId: this.seasonConfig.metadata.id,
            sites: {},
        };
    }
}
