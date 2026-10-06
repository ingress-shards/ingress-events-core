# Game Mechanics: Flash Shards

Flash Shards is a mechanic used during Ingress events in which shards spawn on portals and agents move shards from one portal to another via a link in order to earn points for their faction.

## Shard Movement & Behavior

Shards travel from one portal to another via a link under specific conditions, depending on the rules for an event. Typical conditions include both portals must be L4 or higher.

- **Link Selection**: If multiple viable links exist, the game will choose one of these links **at random** to determine if the jump conditions have been met.
- **Per-Shard Processing**: Choosing a link occurs for **all shards** present on a portal individually; it is possible for multiple shards to travel along different links simultaneously from the same origin portal.

## Target Portals

Target portals are defined by ornaments and serve as the destination for shards to earn high point values.

- **Fixed Faction Alignment**: Targets do not change faction ownership; once a target is spawned, it remains aligned to that faction for as long as it is active.
- **Pseudo Targets**: During certain events (e.g., Shard Investigation), specialized portals such as **NL-1331** vans may serve as "pseudo" targets where both factions can score points.

## Event Parameters

Configuration typically involves the following parameters:

- **Shards**: The number of shards in play.
- **Waves**: The number of waves in the event.
- **Jumps**: The number of jumps a shard can perform within a wave.
- **Targets** (Optional): Destination portals for scoring.
- **Idle Period**: A defined duration to determine if a shard has not moved during this period.

### Configuration Insights

Configuration can vary significantly between sites and events.

- **Wave Persistence**: An event involving shards will always have at least one wave, even if it is not explicitly referred to as such; the entire event may essentially be treated as one shard wave.
- **Jump/Wave Balance**: "Single Shard" events tend to have one wave with multiple jumps occurring over multiple hours. "Multi-Shard" events tend to have multiple waves with multiple jumps each, and are typically shorter in overall length.

## Shard Actions & Telemetry

In Ingress shard events, the interaction between scheduled server behavior and observed shard telemetry is governed by the following core concepts:

- **Window**: The discrete time slice (~1 minute) during which Niantic servers interrogate active shards and evaluate movements.
- **Action**: The scheduled lifecycle command executed during a window (`spawn`, `jump`, `despawn`).
- **Action Reason**: The observable outcome reported in raw Niantic telemetry (`shard-jump-times-*.json`) via the `reason` field:

| Term | Domain Concept | Niantic Raw Telemetry (`reason`) | Description |
| :--- | :--- | :--- | :--- |
| **Window** | Interrogation Window | *(Window timestamp)* | The discrete time slice during which Niantic servers interrogate active shards and execute actions. |
| **Action** | Server Command | `spawn`, `jump`, `despawn` | The scheduled lifecycle action triggered during the window. |
| **Action Reason** | Observed Telemetry | `reason` field in history | The actual outcome recorded for each shard: |
| &nbsp;&nbsp;↳ *Spawn* | Appearance | `spawn` | Shard manifests at designated portal. Zero score. |
| &nbsp;&nbsp;↳ *Link Traversal* | Successful Move | `link` | Shard traverses an eligible link (L4+). Primary scoring mechanism. |
| &nbsp;&nbsp;↳ *Random Teleport* | Idle Teleport | `jump` | Idle period elapsed without valid move; shard teleports to a nearby portal. |
| &nbsp;&nbsp;↳ *No Move* | Stationary | `no move` | No viable link or random link selection failed; shard remains at portal. |
| &nbsp;&nbsp;↳ *Despawn* | Removal | `despawn` | Shard removed from network at wave/event close. Zero score. |

> [!NOTE]
> Only **`jump`** actions contribute towards the score for a site (link traversals and goal arrivals). While **`spawn`** and **`despawn`** actions are recorded in shard history for complete lifecycle traceability, they generate zero points.

## Scoring Logic

Scoring is derived from two primary outcomes, with values specified in the [Scoring Mechanics](../ScoringMechanics.md) document:

1.  **Jump**: Moving a shard to a new portal via a valid link. Points can be earnt either by the length of the link, or if the destination if designated as applicable to this event e.g. Anomaly Zone Portal.
2.  **Arrival**: Securing a shard at a Target Portal.

## Mechanic Variations

The shard mechanic is deployed across different event formats with tailored operational parameters:

- **Standard Anomaly:** Features multiple waves, zone jump scoring, and arrival scoring at faction-aligned Target Portals.
- **[Shard Storm](./ShardStorm.md):** An operational variant that eliminates target portals entirely, scoring exclusively via distance-tiered link traversals across scheduled movement windows.

### **Related Documentation**

- [Shard Storm](./ShardStorm.md)
- [Portal Immunity Instability](./PortalImmunityInstability.md)
- [Architecture & Lifecycle](../architecture/README.md)
- [Data Schema](../Schema.md)
