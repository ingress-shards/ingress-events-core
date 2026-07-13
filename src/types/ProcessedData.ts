import type { SeasonId } from "../common/Identifiers.js";
import type { SeasonRecord } from "../seasons/Season.js";

/**
 * Top-level analyzed data for all tracked events.
 */
export type ProcessedData = Record<SeasonId, SeasonRecord>;
