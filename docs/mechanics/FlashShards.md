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

## Shard Actions

The following canonical actions are recorded in a shard's history:

- **Spawn**: The initial appearance of the shard.
- **Link**: The shard successfully travels because the conditions were met to travel along a viable link (L4+).
- **No Move**: The conditions for travel were not met; either no valid link existed or a randomly selected link was ineligible.
- **Randomly Teleport**: If a shard has not travelled along any link within its specific **Idle Period**, it will randomly teleport to a nearby portal during the next movement window.
- **Despawn**: Removal of the shard from play at the end of a wave.

## Scoring Logic

Scoring is derived from two primary outcomes, with values specified in the [Scoring Evolution](../SCORING.md) document:

1.  **Jump**: Moving a shard to a new portal via a valid link. Points can be earnt either by the length of the link, or if the destination if designated as applicable to this event e.g. Anomaly Zone Portal.
2.  **Arrival**: Securing a shard at a Target Portal.

### **Related Documentation**

- [Architecture & Lifecycle](../Architecture.md)
- [Data Schema](../Schema.md)
