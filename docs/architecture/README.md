# Project Architecture

This document defines the high-level system design and the "Classic Data Lifecycle" that governs all data in the Ingress Events Core project.

## Classic Data Lifecycle

The system follows a seven-stage lifecycle to ensure data integrity and clear separation of concerns.

| Stage | Name       | Primary Responsibility                         |
| ----- | ---------- | ---------------------------------------------- |
| 1     | Generation | Niantic                                        |
| 2     | Collection | Manual / `iitc-plugin-site-observer`           |
| 3     | Processing | Core Library                                   |
| 4     | Storage    | `ingress-shards` / `iitc-plugin-site-observer` |
| 5     | Analysis   | Core Library                                   |
| 6     | Usage      | `ingress-shards` / `iitc-plugin-site-observer` |
| 7     | Archival   | N/A                                            |

### Stage 1: Generation

The creation of data applicable to Ingress Events, available via numerous sources. These can include the Ingress Intel Map, Shard Jumps JSON and manual one-off data dumps.

### Stage 2: Collection

The extraction and capture of data as received (e.g., API responses). Data can be collected in two ways:

1. Manual collection can occur via the Ingress Intel Map or other sources, and may need adjusting to match the format of the data required in stage 3 (usually as a result of bugs).
2. Automated collection of this data via the [iitc-plugin-site-observer](https://github.com/ingress-shards/iitc-plugin-site-observer) plugin.

### Stage 3: Processing

The transformation of raw captures into unified domain models, based around seasons and sites. For details on deduplication, scanning windows, and event phases, see [Processing](./Processing.md).

### Stage 4: Storage

The "Document Persistence Model". The core library defines the JSON document structure; the implementer chooses the persistence method (Filesystem, IndexedDB, etc.).

Storage can consist of both collected and processed files, however they are typically stored in parallel locations e.g. The manual collected data files are stored in the `ingress-shards` project, and the processed data is stored in a separate folder for inclusion in the web app.

### Stage 5: Analysis

The enrichment of stored data to determine event statistics such as points, scores, centroids, and active links. For details on the analysis pipeline, see [Analysis](./Analysis.md).

### Stage 6: Usage

Consumption of analyzed results by end-user interfaces.

### Stage 7: Archival

Long-term management of historical season data for comparison and legacy tracking. This is not implemented at this stage.

---

### **Related Documentation**

- [Game Mechanics](../mechanics/README.md)
- [Data Schema](../Schema.md)
