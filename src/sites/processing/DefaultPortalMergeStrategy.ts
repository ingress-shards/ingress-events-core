import type { ObservedPortal } from "../Portal.js";
import type { PortalMergeStrategy, PortalMergeResult } from "./PortalMergeStrategy.js";

export class DefaultPortalMergeStrategy implements PortalMergeStrategy {
    private mergePortalHistory(
        portal: ObservedPortal,
        incomingHistory: NonNullable<ObservedPortal["history"]>,
        getWaveIndex?: (timestamp: number) => number | undefined
    ): boolean {
        let hasChanged = false;
        const mergedHistory = portal.history ? [...portal.history] : [];

        for (const incomingHist of incomingHistory) {
            const isDuplicate = mergedHistory.some(h => {
                if (h.type !== incomingHist.type) return false;
                if (getWaveIndex) {
                    const existingWave = getWaveIndex(h.timestamp);
                    const incomingWave = getWaveIndex(incomingHist.timestamp);
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
                    if (getWaveIndex) {
                        const lastWave = getWaveIndex(lastEntry.timestamp);
                        const incomingWave = getWaveIndex(incomingHist.timestamp);
                        isSameState = (incomingHist.ornId === lastEntry.ornId) && (lastWave === incomingWave);
                    } else {
                        isSameState = (incomingHist.ornId === lastEntry.ornId);
                    }
                } else if (
                    (incomingHist.type === "battle-beacon" && lastEntry.type === "battle-beacon") ||
                    (incomingHist.type === "pre-event" && lastEntry.type === "pre-event")
                ) {
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

        return hasChanged;
    }

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

            const existingPortal = typeof existingPortalId === "number" ? portals[existingPortalId] : undefined;
            if (existingPortal) {
                portal = existingPortal;
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

            if (incomingPortal.history && incomingPortal.history.length > 0) {
                if (this.mergePortalHistory(portal, incomingPortal.history, options.getWaveIndex)) {
                    hasChanged = true;
                }
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
