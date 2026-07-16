import type { ObservedPortal } from "../Portal.js";
import type { PortalMergeStrategy, PortalMergeResult } from "./PortalMergeStrategy.js";

export class DefaultPortalMergeStrategy implements PortalMergeStrategy {
    public merge(
        existingPortals: Record<number, ObservedPortal>,
        incomingPortals: Record<number, ObservedPortal>,
        options: {
            coordToPortalIdMap: Map<string, number>;
            nextPortalId: number;
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
                // Duplicate timestamp check
                const isDuplicate = mergedHistory.some(h =>
                    h.type === incomingHist.type &&
                    h.timestamp === incomingHist.timestamp
                );

                if (isDuplicate) {
                    console.info(`[DefaultPortalMergeStrategy] Ignoring duplicate history entry at portal ${existingPortalId} (matching timestamp ${incomingHist.timestamp})`);
                    continue;
                }

                // State transition deduplication:
                // Only append if the state actually changes from the previous entry of this type.
                const historyOfType = mergedHistory.filter(h => h.type === incomingHist.type);
                const lastEntry = historyOfType.at(-1);

                let isSameState = false;
                if (lastEntry) {
                    if (incomingHist.type === "target" && lastEntry.type === "target") {
                        isSameState = (incomingHist.ornId === lastEntry.ornId);
                    } else if (incomingHist.type === "battle-beacon" && lastEntry.type === "battle-beacon") {
                        isSameState = (incomingHist.ornId === lastEntry.ornId);
                    } else if (incomingHist.type === "pre-event" && lastEntry.type === "pre-event") {
                        isSameState = (incomingHist.ornId === lastEntry.ornId);
                    }
                }

                if (isSameState) {
                    console.info(`[DefaultPortalMergeStrategy] Ignoring duplicate state transition at portal ${existingPortalId} (state '${incomingHist.type}' ornament ID remained '${(incomingHist as any).ornId}')`);
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
            console.info(`[DefaultPortalMergeStrategy] Completed merge: ${portalCount} portals successfully processed.`);
        } else {
            console.warn(`[DefaultPortalMergeStrategy] Consistency mismatch: portals count (${portalCount}) !== coordToPortalIdMap size (${coordToPortalIdMap.size})`);
        }

        return { portals, coordToPortalIdMap, nextPortalId, hasChanged };
    }
}
