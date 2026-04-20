# Ingress Events Core: Documentation

This directory contains the "Source of Truth" for the architecture, mechanics, and data models used across the Ingress Events Core project.

## Project Mission

To provide a robust, self-contained library for the collection and analysis of Ingress event data, using the **Classic Data Lifecycle** as our technical foundation.

> [!IMPORTANT]
> **Bounded Context:** This project exclusively tracks and models _locale-based, physical events_ that feature on-the-ground mechanics (e.g., Anomalies, Skirmishes etc.). It intentionally does not track global, virtual, or location-agnostic events.

## Domain Scope: Events vs. Mechanics

It is important to distinguish between **Events** and **Mechanics**:
- **Events** (e.g., Anomalies, Skirmishes, First Saturdays) are scheduled occurrences. An event may include one or many game mechanics.
- **Mechanics** (e.g., Shards, Battle Beacons) are the trackable, in-game functional rulesets deployed during those events.

### Out-of-Scope Events

The following event formats lack tangible, programmatic mechanic data and therefore fall strictly outside the bounded context of this tracking library:

- **Campaigns**: (Encompassing Global Ops, Anomaly Campaigns, and generic Campaigns). These are typically virtual or location-agnostic.
- **First Saturdays** & **Hexathlons**: While these occur at specific physical locations, they do not deploy trackable, localized mechanic data in a way this system monitors.

## Table of Contents

- **[Game Mechanics](./mechanics/README.md)**
    - [Flash Shards](./mechanics/FlashShards.md)
    - [Battle Beacons](./mechanics/BattleBeacons.md)
    - [Recursive State Portals](./mechanics/RecursiveStatePortals.md)
- **[Project Architecture](./Architecture.md)**
    - [Seven-Stage Data Lifecycle](./Architecture.md#classic-data-lifecycle)
    - [Point vs. Score](./Architecture.md#points-vs-scores)
    - [Development Glossary](./Architecture.md#development-glossary)
- **[Data Schema](./Schema.md)**
    - [Collection Layer](./Schema.md#1-collection-layer)
    - [Storage Layer](./Schema.md#2-storage-layer)
    - [Analysis Layer](./Schema.md#3-analysis-layer)

## Niantic Event Hierarchy

These terms are used by Niantic and we are adopting them for consistency in the codebase and against official descriptions:

1.  **Season**: The over-arching event groupings (e.g., "Plus Alpha"). It typically spans several months. (Legacy terminology: **Series**).
2.  **Event**: Individual event formats (e.g., **Anomaly**, **First Saturday**, **Global Op**).
3.  **Site**: The precise location where the event occurs (e.g., "Singapore", "Los Angeles"). A site can be used more than once in a season for different events (e.g., New Zealand and Sao Paulo hosted both an Anomaly and a Shard Storm during the +Beta season).

---

### **Agent Note**

- Always consult these documents before proposing changes to the `ingress-events-core` types to ensure architectural consistency.
