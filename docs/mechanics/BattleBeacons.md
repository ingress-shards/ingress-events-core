# Game Mechanics: Battle Beacons

Battle Beacons are a multi-round competitive mechanic used in Ingress events. They are deployed on portals and award points to the controlling faction at the conclusion of each checkpoint.

## Beacon Parameters

Battle Beacons are configured using the following parameters:

| Parameter                   | Description                                                                                                        |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **Countdown**               | The time between the beacon being deployed and the battle beacon start.                                            |
| **No. of Checkpoints**      | The number of checkpoints that will occur during the beacon.                                                       |
| **Checkpoint Interval**     | The time between each checkpoint.                                                                                  |
| **Scoring**                 | The points awarded to the controlling faction for each checkpoint.                                                 |
| **Victory Beacon Duration** | The duration of the winning faction's victory beacon displayed on the portal after the battle beacon has finished. |

## Battle Beacon Types

There are two primary types of Battle Beacons which can be deployed by agents: Rare and Very Rare, each with their own timing and checkpoint structures.

| Type          | Countdown  | No. of Checkpoints | Checkpoint Interval | Scoring              | Victory Beacon Duration |
| :------------ | :--------- | :----------------- | :------------------ | :------------------- | :---------------------- |
| **Rare**      | 10 minutes | 3                  | 3 minutes           | 2, 3, 4 points       | 1 hour                  |
| **Very Rare** | Instant    | 5                  | 3 minutes           | 1, 2, 2, 3, 4 points | 4 hours                 |

During events, Niantic may deploy their own rare battle beacons. These beacons have the same timing and checkpoint structures as their agent-deployed counterparts, but behave slightly differently:

- **Ornaments**: Official rare beacons deployed by Niantic during events are accompanied by a specific ornament: **Standard** or **Volatile Portal**.
- **Force-Replacement**: Niantic-deployed beacons forcibly replace any pre-existing agent-deployed beacons (both battle and visual beacons).

## Scoring Logic & Round Completion

Scoring is registered at the conclusion of each checkpoint:

- **Ownership Check**: Points are awarded to the faction controlling the portal at the precise moment the checkpoint ends. If the portal is neutral at the time of the checkpoint, no points are awarded.
- **Volatile Multiplier**: Official beacons on Volatile Portals are awarded **3x** the standard point values i.e. 6, 9, and 12 points respectively.
- **Wave Scoring**: The faction score for a wave is calculated by summing the raw points of all deployed Battle Beacons.

---

### **Related Documentation**

- [Architecture & Lifecycle](../Architecture.md)
- [Data Schema](../Schema.md)
