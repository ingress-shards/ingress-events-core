# Shard Storm Mechanics Specification

> [!NOTE]
> **Mechanic Variant:** Shard Storm is an operational variation of [Flash Shards](./FlashShards.md). It inherits underlying shard physics (Level 4+ portal requirements, link traversals, random link selection, idle teleportation, and despawn lifecycles) but modifies target scoring and movement cadence.

## 1. Overview
A **Shard Storm** (`STORM`) is a competitive operation where Shards manifest at designated sites worldwide and move across faction-owned links over scheduled movement windows.

Unlike standard Anomaly operations, Shard Storms:
- **Do not utilize Target Portals:** There are no faction targets or goal arrival rules.
- **Score exclusively via Link Traversals:** Points are awarded based on the length of the link traversed during movement windows.
- **Run Alongside Environmental Modifiers:** Typically operates in tandem with [Portal Immunity Instability](./PortalImmunityInstability.md).

---

## 2. Core Scoring Rules

Scoring is governed by two link scoring rules defined in `event_blueprints.json`:

1. **`storm_jump_1-5` (Short Jump):**
   - **Condition:** Link length between 1 km and 5 km ($1000\text{m} \le \text{distance} \le 5000\text{m}$).
   - **Points:** 5 Season Points per jump.
2. **`storm_jump_10` (Long Jump):**
   - **Condition:** Link length of 10 km or greater ($\text{distance} \ge 10000\text{m}$).
   - **Points:** 10 Season Points.
   - **Rule Constraint:** `allowFurtherPoints: false`. Once a shard achieves a jump $\ge 10\text{km}$, it permanently ceases scoring for the remainder of the event day (points accrued prior to the jump are retained).

---

## 3. Operational Mechanics

- **Movement Eligibility:** Shards only traverse links between portals of Level 4 (L4) or higher and will not backtrack to a portal occupied in the previous 150 minutes.
- **Link Selection:** If multiple viable links exist at a portal during a movement tick, one link is selected at random.
- **Environmental Modifiers:** Operations run alongside [Portal Immunity Instability](./PortalImmunityInstability.md), with immunity durations fluctuating unpredictably throughout the day.

---

## 4. Seasonal Evolution & Blueprint Variations

The operational cadence, number of shards, and temporal structures have evolved across seasons. The active behaviour is defined per season in `season_manifest.json` by referencing the appropriate blueprint.

### Version 1: Season 2025 (+Beta) — Blueprint `1w_480m_4j`

- **Shards per Site:** 1 Shard.
- **Event Start:** 13:00 local time.
- **Total Duration:** 480 minutes (8 hours; despawn at 21:00).
- **Cadence:** 4 hourly jumps at 14:00, 15:00, 16:00, and 17:00 (offsets: +60m, +120m, +180m, +240m).
- **Scoring Ceiling:**
  - Max per Shard / Site: **25 Season Points** (3 short jumps $\times$ 5pt + 1 long jump of 10pt).

| Milestone | Local Time | Offset from Start | Action |
| :--- | :--- | :--- | :--- |
| **Manifest (Spawn)** | 13:00 | +0 min | 1 Shard appears |
| **Jump 1** | 14:00 | +60 min | Movement tick 1 |
| **Jump 2** | 15:00 | +120 min | Movement tick 2 |
| **Jump 3** | 16:00 | +180 min | Movement tick 3 |
| **Jump 4** | 17:00 | +240 min | Final movement tick |
| **Stationary Phase** | 17:00 – 21:00 | +240 to +480 min | Shards remain stationary |
| **Despawn** | 21:00 | +480 min | Shard removed from network |

---

### Version 2: Season 2026 (Cygnus) — Blueprint `1w_420m_18j`

- **Shards per Site:** 3 Shards.
- **Event Start:** 14:00 local time.
- **Total Duration:** 420 minutes (7 hours; despawn at 21:00).
- **Cadence:** 6 half-hourly movement windows with 2-minute micro-staggers:
  - Shard 1 moves at :15 / :45
  - Shard 2 moves at :17 / :47
  - Shard 3 moves at :19 / :49
- **Scoring Ceiling:**
  - Max per Shard: **35 Season Points** (5 short jumps $\times$ 5pt + 1 long jump of 10pt).
  - Max per Site: **105 Season Points** (3 Shards $\times$ 35pt).
  - Max per Event Day (6 Sites): **630 Season Points**.

| Window | Local Time | Offsets | Movement Cadence |
| :--- | :--- | :--- | :--- |
| **Spawn** | 14:00 | +0 min | 3 Shards appear at designated portals |
| **Window 1** | 14:15 – 14:19 | +15m, +17m, +19m | Jumps 1, 2, 3 (Shard 1 @ :15, Shard 2 @ :17, Shard 3 @ :19) |
| **Window 2** | 14:45 – 14:49 | +45m, +47m, +49m | Jumps 4, 5, 6 |
| **Window 3** | 15:15 – 15:19 | +75m, +77m, +79m | Jumps 7, 8, 9 |
| **Window 4** | 15:45 – 15:49 | +105m, +107m, +109m | Jumps 10, 11, 12 |
| **Window 5** | 16:15 – 16:19 | +135m, +137m, +139m | Jumps 13, 14, 15 |
| **Window 6** | 16:45 – 16:49 | +165m, +167m, +169m | Jumps 16, 17, 18 (Final movement window) |
| **Stationary** | 16:49 – 21:00 | +169 to +420 min | Shards remain stationary |
| **Despawn** | 21:00 | +420 min | Shards removed from network |

---

## 5. Comparative Specification Matrix

| Parameter | Version 1 (+Beta 2025) | Version 2 (Cygnus 2026) |
| :--- | :--- | :--- |
| **Blueprint Key** | `1w_480m_4j` | `1w_420m_18j` |
| **Shards per Site** | 1 | 3 |
| **Waves** | 1 | 1 |
| **Movement Windows** | 4 (hourly) | 6 (half-hourly) |
| **Total Jump Actions** | 4 | 18 (3 staggered per window) |
| **Window Structure** | Single jump on the hour | 2-min micro-stagger (+0m, +2m, +4m into window) |
| **Start Time** | 13:00 | 14:00 |
| **Movement Period** | 14:00 – 17:00 (3 hrs) | 14:15 – 16:49 (2 hrs 34 min) |
| **Stationary Period** | 17:00 – 21:00 (4 hrs) | 16:49 – 21:00 (4 hrs 11 min) |
| **Max Points / Shard** | 25 pts | 35 pts |
| **Max Points / Site** | 25 pts | 105 pts |

---

## 6. Grouped Jumps & Presentation Architecture

In multi-shard staggered events (such as `1w_420m_18j`), discrete action offsets (`+15m, +17m, +19m`) are preserved in `waveActions` to support exact real-time plugin polling (e.g. `ObserverScheduler` triggering fetches 1 minute after each movement).

To prevent presentation bloat (e.g. 20-column wide tables), presentation grouping is decoupled from domain blueprints:
- **`display.shards.jumpGroupSize` on Season Component:** Configures how many consecutive jump windows to group together in presentation views (e.g. `3` for Cygnus 2026, defaulting to `1`).
- **Presentation Grouping Helper:** `ShardJumpGrouper.getShardJumpGroups()` chunks consecutive `ShardJumpWindow` items by `jumpGroupSize` and dynamically derives concise range labels (`J1-3`, `J4-6`) and formatted time ranges (`14:15–19`).
- **Transposed Presentation:** UIs render jumps as rows, standardizing display width (~340px) across mobile and desktop without horizontal scroll.

---

## 7. Related Documentation

- [Flash Shards](./FlashShards.md)
- [Portal Immunity Instability](./PortalImmunityInstability.md)
- [Scoring Mechanics](../ScoringMechanics.md)
- [Data Schema](../Schema.md)
- [Architecture & Lifecycle](../architecture/README.md)

