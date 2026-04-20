# Game Mechanics: Ingress Events

This document provides a high-level summary of various Ingress game mechanics and serves as the domain reference for our data processing logic.

> [!NOTE]
> Mechanics for which we can collect and analyse data have their own dedicated page for further technical details.

## Trackable Physical Mechanics

The following physical mechanics generate tangible data and are the core focus of this library:

- **[Flash Shards](./FlashShards.md)**
- **[Battle Beacons](./BattleBeacons.md)**
- **[Recursive State Portals](./RecursiveStatePortals.md)**
- **Covert Caches** _(A historic, physical precursor to Recursive State Portals. Trackable at physical locations, but requires no ongoing documentation.)_

## Game Mechanic Glossary

To ensure consistency in the codebase and user interface, the following terms are used:

| Term              | Definition                                                                                                       |
| :---------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Portal**        | A virtual object in the Ingress world which correlates to a point of interest (POI) in the real world.           |
| **Ornament**      | A visual marker placed on a portal by Niantic to indicate it has a particular importance at any particular time. |
| **Shard**         | A virtual object that moves between portals during defined windows.                                              |
| **Battle Beacon** | A multi-round competitive mechanic used in Ingress events.                                                       |

---

### **Related Documentation**

- [Architecture & Lifecycle](../Architecture.md)
- [Data Schema](../Schema.md)
