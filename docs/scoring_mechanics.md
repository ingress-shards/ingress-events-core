# Scoring Mechanics Specification

This document defines the configuration schema and mathematical models used to calculate and aggregate scores for Ingress events (like Shards).

## 1. Architecture Overview

Scoring is split into two parts:
1. **Rule Templates (`event_blueprints.json`):** A library of raw scoring rules (e.g. points awarded per jump, ornament arrivals, or target captures) defined independently of seasons/events.
2. **Event Composition (`season_manifest.json`):** Defines which scoring rules apply to a given event, how waves are grouped/aggregated, and how season leaderboard points are scaled.

---

## 2. Blueprint Rule Definitions

Rules are defined under `scoringRules` in `event_blueprints.json` and are categorized by entity type (e.g. `shards`):

```json
"scoringRules": {
  "shards": {
    "default_jump": {
      "label": "Jumps",
      "tooltip": "Shard jump along an eligible Link",
      "points": 1
    }
  }
}
```

### Properties:
- **`label`:** The user-facing short label for the score column (e.g., "Jumps", "Zone", "Target").
- **`tooltip`:** Helpful description of the rule shown on hover.
- **`points`:** Number of raw points awarded when the rule is met.
- **`conditions`:** Specific requirements that must be met (e.g., `minDistance`, `maxDistance`, or matching `ornaments`).
- **`maxScoringShardsPerPortal`:** Capping mechanism (e.g., only the first 4 shards landing on a portal score).
- **`teamAttribution`:** Who receives the points (`LINK_OWNER` or `TARGET_OWNER`).

---

## 3. Wave Aggregation Model

Sites aggregate their waves dynamically using a multi-dimensional array configured in the manifest under `wavePointAggregation`. Each inner array represents a group of waves to evaluate.

### Defaults:
- **If `wavePointAggregation` is omitted:** The default behavior is to aggregate all waves by simply summing their raw points together (`SUM` of all waves).

### Math Formula:
For each group of waves, the engine takes the **maximum** (highest) score achieved by each faction, then **sums** those group maximums together to get the total site score.

#### Example: `[[1, 2], [3, 4], [5, 6]]` (Paired Waves)
$$\text{Total Score} = \max(\text{Wave } 1, \text{Wave } 2) + \max(\text{Wave } 3, \text{Wave } 4) + \max(\text{Wave } 5, \text{Wave } 6)$$

#### Example: `[[1, 2, 3, 4, 5, 6]]` (Best of all waves)
Since there is only one group containing all waves:
$$\text{Total Score} = \max(\text{Wave } 1, \text{Wave } 2, \text{Wave } 3, \text{Wave } 4, \text{Wave } 5, \text{Wave } 6)$$


---

## 4. Leaderboard Season Points Scaling

Once the final raw scores are calculated for each faction across all aggregated waves, the `seasonPoints` allocated to the site are split proportionally:

$$\text{Faction Season Points} = \text{Season Points Total} \times \left( \frac{\text{Faction Raw Score}}{\text{Total Combined Faction Raw Scores}} \right)$$

Results are rounded to the nearest decimal place (1 decimal point).
