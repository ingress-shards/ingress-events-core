import type { ObservedPortal } from "../Portal.js";

export interface PortalMergeResult {
    portals: Record<number, ObservedPortal>;
    coordToPortalIdMap: Map<string, number>;
    nextPortalId: number;
    hasChanged: boolean;
}

export interface PortalMergeStrategy {
    merge(
        existingPortals: Record<number, ObservedPortal>,
        incomingPortals: Record<number, ObservedPortal>,
        options: {
            coordToPortalIdMap: Map<string, number>;
            nextPortalId: number;
        }
    ): PortalMergeResult;
}
