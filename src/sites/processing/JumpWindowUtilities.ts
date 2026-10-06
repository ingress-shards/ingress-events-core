export interface JumpWindowBounds {
    windowStart: number;
    nextWindowStart?: number;
    waveStart: number;
    waveEnd: number;
}

/**
 * Checks whether a shard movement occurred during a specific scheduled jump window.
 */
export const isMovementInWindow = (
    h: { action: string; moveTime: number },
    window: JumpWindowBounds
): boolean => {
    if (h.moveTime < window.waveStart || h.moveTime > window.waveEnd) return false;
    if (!["jump", "link", "no move"].includes(h.action)) return false;
    if (h.moveTime < window.windowStart) return false;
    if (window.nextWindowStart !== undefined) {
        return h.moveTime < window.nextWindowStart;
    }
    return h.moveTime <= window.waveEnd;
};
