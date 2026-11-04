# Stage 5: Analysis - Metrics and Calculations

This document details the analysis pipeline, metrics, and score concepts that govern the Stage 5 (Analysis) of the Ingress Events Core library.

---

## 1. Score Concepts: Points vs. Scores

We distinguish between the points scored by agent actions, and the final score achieved by the faction.

* **Points**: Raw cumulative tallies of actions (e.g., a shard jump awarded 10 points).
* **Scores**: The final rule-based result derived from Points (e.g., a ratio of 100 points is split between the two factions based on points earned during a wave).

In some events, points and scores can have a 1-to-1 relationship. In other events, the highest number of points scored in a wave is used to determine the final score.

---

## 2. Site Analysis Pipeline

To enrich site data for ingestion and visual display, a calculation pass is run post-merge to generate the `SiteAnalysis` object:

### Centroid Calculation
* **Behavior:** The geographic center point (`centroid`) is calculated by taking the average of all coordinates (`latE6`, `lngE6`) across all observed portals on the site.
* **Fallbacks:** If no portals have been observed for the site, the `centroid` remains `undefined` (omitted entirely from the analysis payload).

### Shard & Link Classification
* **Behavior:** Shard history is analyzed to classify shards and count active link connections:
  * **Moving Shards:** A shard is counted as moving if its history contains at least one movement action (`link` or `jump`).
  * **Non-Moving Shards:** A shard is classified as non-moving if it has only a spawn action or no recorded movement events.
* **Recalculation:** The entire analysis is wiped and recalculated from scratch (`new SiteRecordAnalyser().analyse(...)`) immediately after the merger completes.

### Directory Separation: Processing vs. Analysis
The library strictly separates observation ingestion/merging from analytical evaluation into distinct modules:
* `src/pipeline/merging/` & `src/pipeline/adapters/`: Observation ingestion, parsing, and state merging (`DataIngestionPipeline`, `SiteRecordMerger`, `PortalMergeStrategy`, `DefaultPortalMergeStrategy`).
* `src/pipeline/analysis/`: Analysis orchestration, graph path construction, scoring engines, window builders, and metric calculators.

### Analysis Progression & Composition Root
`SiteRecordAnalyser` acts as the single **Composition Root** for the analysis pipeline, instantiating all domain services with site-level scope before executing a strict, unidirectional progression:
1. **Physical Paths (`ShardPathBuilder`)**: Builds topological paths between portal pairs (`siteShardPaths`) and records movement transits.
2. **Link Scoring (`LinkScoringEngine`)**: Chronologically scores shard link moves across paths, annotating each move with matched `scoredRules` and calculated `totalPoints`.
3. **Wave State Progression (`WaveAnalyser`)**:
   * Iterates over scheduled waves (`analyse`) and builds each wave's state, short-circuiting when a wave has no active `shardJumpWindows`.
   * **Jump Windows (`ShardJumpWindowBuilder`)**: Ingests `targetScorer`, `shards`, and `shardPaths`, building sequential jump windows (`buildWaveWindows`) and evaluating target arrivals via `TargetScoringEngine.scoreJumpWindow`. Window-level points, link rule counts, target goal details (`scoredCount` / `unscoredCount` omitted when `0`), and alignment mismatches are consolidated per faction inside `ShardJumpWindow.factionBreakdowns` (omitted entirely when no scoring or mismatch occurs in a window).
   * **Wave Points (`PointsSnapshot`)**: Derives wave `total`, `links`, and `goals` directly from the constituent `ShardJumpWindow[]`, omitting any empty category objects.
   * **Wave Statistics (`StatisticsCalculator`)**: Calculates wave moving/non-moving shards, links, paths, and targets.
   * **Wave Diagnostics (`DiagnosticsCalculator`)**: Calculates wave link alignment mismatches.
4. **Site-Wide Aggregations**:
   * **Season Points (`SeasonPointsCalculator`)**: Aggregates wave points into season points according to blueprint rules (`SeasonPointsConfig`).
   * **Site Statistics (`StatisticsCalculator.aggregate`)**: Aggregates multi-wave statistics.
   * **Site Diagnostics (`DiagnosticsCalculator.aggregate`)**: Aggregates multi-wave diagnostics.

> **Future Optimization Note (Phase 5 Map Integration):** `ShardMove.scoredRules` is currently populated during `LinkScoringEngine.scorePaths` and consumed in-memory by `ShardJumpWindowBuilder`. Once map link popups in `ingress-shards.github.io` are migrated in Phase 5 (which only require `ShardMove.totalPoints` while rule breakdowns live in `WaveState.shardJumpWindows`), `ShardMove.scoredRules` can be evaluated for omission from serialized output.

### Analysis Domain Services
* `SiteRecordAnalyser`: Composition Root and top-level orchestrator.
* `ShardPathBuilder`: Builds topological portal paths and chronological shard links/moves from shard history.
* `LinkScoringEngine`: Applies link scoring rules across all shard paths (`scorePaths`) and sets `move.totalPoints`.
* `TargetScoringEngine`: Evaluates goal arrivals and portal scoring limits for target portals per jump window (`scoreJumpWindow`).
* `ShardJumpWindowBuilder`: Builds discrete jump windows, attaching per-faction points, link rule breakdowns, goal breakdowns, and alignment mismatches.
* `WaveAnalyser`: Lightweight coordinator assembling `WaveState` from jump windows, statistics, and diagnostics.
* `StatisticsCalculator`: Computes wave-level statistics and aggregates multi-wave site statistics.
* `DiagnosticsCalculator`: Evaluates wave-level anomaly diagnostics and aggregates multi-wave site diagnostics.
* `SeasonPointsCalculator`: Computes season points distributions, wave point aggregations, and tracks contributing waves from `SeasonPointsConfig`.
