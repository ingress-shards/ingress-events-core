# Stage 3: Processing - Observation Deduplication & Scanning Phases

This document details the business rules, deduplication constraints, scanning windows, and event phases that govern the Stage 3 (Processing) of the Ingress Events Core library.

---

## 1. Deduplication Rules

### Portal History & State Transition Deduplication
* **Behavior:** Portals accumulate history entries across multiple scanning phases (pre-event, target, battle-beacon).
* **Deduplication:**
  * **Timestamp-based Deduplication:** Any incoming history entry is ignored if it matches the exact timestamp of an existing history entry on that portal.
  * **Transition-based Deduplication:** For sequential observations of the same category, consecutive entries are only appended if a state change occurred (e.g., the ornament ID changed). If the ornament ID remains identical, the duplicate state transition is filtered out to avoid inflating the history log.

### Targets
* **Behavior:** Targets are unique for each anomaly and do not change once they are established.
* **Deduplication:** 
  * If a target is already recorded in the site's history for the event, any subsequent target observations for that event are ignored.
  * A verification message is logged, and the incoming target data is safely discarded.

### Shards (Shard Jumps)
* **Behavior:** Shards are tracked dynamically as they move across portals.
* **Deduplication:**
  * Deduplication is driven by the shard's actual **`moveTime`** (the game event timestamp) rather than the observer's poll timestamp.
  * Any incoming jump record for a given shard number that shares the same `moveTime` and destination as an existing record is ignored.

### Battle Beacons (Future Implementation)
* **Behavior:** Battle Beacons represent a complex progression of multiple ornaments on a single portal:
  * **Active Phase:** A combination of a rare battle beacon ornament (`bb_s` or `peBB_BATTLE`) and a portal type ornament (`ap1` for a normal battle beacon, or `ap1_v` for a volatile battle beacon).
  * **End Phase:** Once resolved, the portal displays a winner ornament indicating the faction outcome or a tie:
    * Resistance Win: `peBN_RES_WINNER` or `peBN_RES_WINNER-60`
    * Enlightened Win: `peBN_ENL_WINNER` or `peBN_ENL_WINNER-60`
    * Tied outcome: `peBN_TIED_WINNER` or `peBN_TIED_WINNER-60`
* **Deduplication:** (To be implemented when Battle Beacon support is added).

---

## 2. Event Phases and Scanning Windows

The lifecycle of an anomaly event is divided into distinct scanning phases relative to the `eventStartTime`:

```
                           Event Lock
                             Wipe
                            Wipes OFF
   Pre-Event Phase            Lock          Idle Period           Live Phase
 ───────────────────────┬───────────────┬─────────────────┬────────────────────────
                        │               │                 │
                  -2 Hours        -2 Hours            -5 Mins       +5 Mins Post-Last-Update
```

### Pre-Event Phase (`scanTime < eventStartTime - 2 hours`)
* **Behavior:** Map snapshots are treated as a clean slate for pre-event ornaments.
* **Merger Logic:** Wipe-and-replace. Incoming pre-event portal coordinates replace previous pre-event records to eliminate duplicates and keep data fresh.

### Idle Phase / Event Lock (`eventStartTime - 2 hours` to `eventStartTime - 5 minutes`)
* **Behavior:** The pre-event ornaments are **locked**.
* **Merger Logic:** The plugin must **not** perform any automated scans during this window.

### Live Phase (`eventStartTime - 5 minutes` to `5 minutes after the last expected update`)
* **Behavior:** The event is live. Snapshot and shard jump observations are captured.
* **Merger Logic:** Incoming observations are appended to the historical record, preserving chronological state transitions.
* **Note:** Shard despawns are excluded from the end-of-live-phase boundary calculation.
