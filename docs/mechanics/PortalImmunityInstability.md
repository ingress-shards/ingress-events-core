# Game Mechanics: Portal Immunity Instability

## 1. Overview

Under standard Ingress operational rules, when an **ADA Refactor** or **Jarvis Virus** alignment reversal device (colloquially known as a "flip card") is deployed on a portal, that portal enters a strict **60-minute immunity period**. During this window, any subsequent attempt to deploy another alignment device will fail, consuming the device without effect.

**Portal Immunity Instability** is an environmental event modifier introduced by Niantic that temporarily destabilizes this fixed cooldown period during specific event windows.

---

## 2. Mechanic Characteristics

- **Dynamic Duration:** Rather than a fixed 60-minute window, the immunity duration fluctuates (typically between **5 and 55 minutes**).
- **Periodic Randomization:** The active immunity window duration is globally re-rolled at regular intervals (approximately every 30 minutes) or randomized on each flip occurrence depending on event rules.
- **Cross-Event Application:** This mechanic is not tied to any single entity type or operation. It is commonly deployed during:
  - Anomaly series weekends
  - Shard Storm operational days
  - Dedicated global challenges and tactical field operations

---

## 3. Operational Impact

- **Link Defense & Destruction:** Shorter immunity durations allow defending and attacking factions to reclaim, neutralize, or flip portals far more rapidly than during standard operations.
- **Resource Management:** Tactical planning must account for rapid turnover and increased consumption of alignment devices and Level 8 resonators.
- **Shard Interception:** In shard operations (such as [Flash Shards](./FlashShards.md) and [Shard Storm](./ShardStorm.md)), unstable immunity prevents teams from relying on hour-long portal locks to block or secure shard trajectories.

---

### **Related Documentation**

- [Flash Shards](./FlashShards.md)
- [Shard Storm](./ShardStorm.md)
- [Architecture & Lifecycle](../architecture/README.md)
- [Data Schema](../Schema.md)
