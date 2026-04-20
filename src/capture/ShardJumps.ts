import type { Portal } from "../sites/Portal.js";

/**
 * RAW interface for the getShardHistory Intel endpoint.
 */
export interface ShardJumpCapture {
    artifact: (FragmentArtifact | TargetArtifact)[];
}

interface ArtifactCapture {
    id: string;
    name: string;
}

/**
 * A fragment artifact specifies all fragments deployed at a site since the start of the event.
 */
export interface FragmentArtifact extends ArtifactCapture {
    fragment?: Fragment[];
}

/**
 * A target artifact specifies all target portals currently active at a site.
 */
export interface TargetArtifact extends ArtifactCapture {
    target?: TargetPortalCapture[];
}

/**
 * A fragment is the equivalent of a shard. It specifies all history for the shard.
 */
export interface Fragment {
    id: string;
    currentPortalInfo?: PortalInfoCapture;
    history: FragmentHistoryType[];
}

export interface TargetPortalCapture {
    portalInfo: PortalInfoCapture;
    targetAlignment: string;
}

export interface PortalInfoCapture extends Portal {
    team: string;
}
export interface FragmentHistory {
    moveTimeMs: string;
    originCapturerTeam: string;
    destinationCapturerTeam: string;
    linkCreatorTeam: string;
}

export interface FragmentHistorySpawn extends FragmentHistory {
    reason: "spawn";
    destinationPortalInfo?: PortalInfoCapture;
}

export interface FragmentHistoryDespawn extends FragmentHistory {
    reason: "despawn";
    originPortalInfo?: PortalInfoCapture;
}

export interface FragmentHistoryLink extends FragmentHistory {
    reason: "link" | "jump";
    originPortalInfo?: PortalInfoCapture;
    destinationPortalInfo?: PortalInfoCapture;
    linkCreationTimeMs?: string;
    linkOriginatedFromOriginPortal?: string;
}

export interface FragmentHistoryNoMove extends FragmentHistory {
    reason: "no move";
}

export type FragmentHistoryType =
    | FragmentHistorySpawn
    | FragmentHistoryDespawn
    | FragmentHistoryLink
    | FragmentHistoryNoMove;
