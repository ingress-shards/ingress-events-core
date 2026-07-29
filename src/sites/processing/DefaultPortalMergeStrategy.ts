import type { ObservedPortal } from "../Portal.js";
import type { PortalMergeStrategy, PortalMergeResult } from "./PortalMergeStrategy.js";

export class DefaultPortalMergeStrategy implements PortalMergeStrategy {
    public merge(
        existingPortals: Record<number, ObservedPortal>,
        incomingPortals: Record<number, ObservedPortal>,
        options: {
            coordToPortalIdMap: Map<string, number>;
            nextPortalId: number;
            getWaveIndex?: (timestamp: number) => number | undefined;
        }
    ): PortalMergeResult {
        const portals = structuredClone(existingPortals);
        const coordToPortalIdMap = new Map(options.coordToPortalIdMap);
        let nextPortalId = options.nextPortalId;
        let hasChanged = false;

        // Merge incoming portals from the scan
        for (const incomingPortal of Object.values(incomingPortals)) {
            const coordKey = `${incomingPortal.latE6}_${incomingPortal.lngE6}`;
            let existingPortalId = coordToPortalIdMap.get(coordKey);

            let portal: ObservedPortal;

            if (typeof existingPortalId === "number" && portals[existingPortalId]) {
                portal = portals[existingPortalId]!;
                if (incomingPortal.title && portal.title !== incomingPortal.title) {
                    portal.title = incomingPortal.title;
                    hasChanged = true;
                }
                if (incomingPortal.guid && !portal.guid) {
                    portal.guid = incomingPortal.guid;
                    hasChanged = true;
                }
            } else {
                existingPortalId = nextPortalId++;
                coordToPortalIdMap.set(coordKey, existingPortalId);
                portal = {
                    title: incomingPortal.title,
                    latE6: incomingPortal.latE6,
                    lngE6: incomingPortal.lngE6,
                    ...(incomingPortal.guid && { guid: incomingPortal.guid }),
                };
                portals[existingPortalId] = portal;
                hasChanged = true;
            }

            const incomingHistory = incomingPortal.history ?? [];
            const mergedHistory = portal.history ? [...portal.history] : [];

            // Append history entries (with state transition / duplicate checks)
            for (const incomingHist of incomingHistory) {
                // Duplicate timestamp / wave check
                const isDuplicate = mergedHistory.some(h => {
                    if (h.type !== incomingHist.type) return false;
                    if (options.getWaveIndex) {
                        const existingWave = options.getWaveIndex(h.timestamp);
                        const incomingWave = options.getWaveIndex(incomingHist.timestamp);
                        if (existingWave !== undefined && incomingWave !== undefined) {
                            return existingWave === incomingWave;
                        }
                    }
                    return h.timestamp === incomingHist.timestamp;
                });

                if (isDuplicate) {
                    continue;
                }

                // State transition deduplication:
                // Only append if the state actually changes from the previous entry of this type.
                const historyOfType = mergedHistory.filter(h => h.type === incomingHist.type);
                const lastEntry = historyOfType.at(-1);

                let isSameState = false;
                if (lastEntry) {
                    if (incomingHist.type === "target" && lastEntry.type === "target") {
                        if (options.getWaveIndex) {
                            const lastWave = options.getWaveIndex(lastEntry.timestamp);
                            const incomingWave = options.getWaveIndex(incomingHist.timestamp);
                            isSameState = (incomingHist.ornId === lastEntry.ornId) && (lastWave === incomingWave);
                        } else {
                            isSameState = (incomingHist.ornId === lastEntry.ornId);
                        }
                    } else if (incomingHist.type === "battle-beacon" && lastEntry.type === "battle-beacon") {
                        isSameState = (incomingHist.ornId === lastEntry.ornId);
                    } else if (incomingHist.type === "pre-event" && lastEntry.type === "pre-event") {
                        isSameState = (incomingHist.ornId === lastEntry.ornId);
                    }
                }

                if (isSameState) {
                    continue;
                }

                mergedHistory.push(incomingHist);
                hasChanged = true;
            }

            if (mergedHistory.length > 0) {
                mergedHistory.sort((a, b) => a.timestamp - b.timestamp);
                portal.history = mergedHistory;
            }
        }

        // Verify count consistency
        const portalCount = Object.keys(portals).length;
        if (portalCount === coordToPortalIdMap.size) {
            console.info(`[Site Observer: Portal Merge] Completed merge: ${portalCount} portals successfully processed.`);
        } else {
            console.warn(`[Site Observer: Portal Merge] Consistency mismatch: portals count (${portalCount}) !== coordToPortalIdMap size (${coordToPortalIdMap.size})`);
        }

        return { portals, coordToPortalIdMap, nextPortalId, hasChanged };
    }
}
