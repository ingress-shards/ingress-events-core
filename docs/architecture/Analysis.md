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
  * **Link Actions:** The total count of `link` actions across all shard histories is summed up to represent the total event links.
* **Recalculation:** The entire analysis is wiped and recalculated from scratch (`SiteRecordAnalyzer.analyze()`) immediately after the merger completes.
