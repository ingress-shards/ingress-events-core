import { formatDuration } from "../common/Date.js";
import { SitePhase } from "../sites/Site.js";

export const PhaseDisplayNames: Record<SitePhase, string> = {
    [SitePhase.Scheduled]: "Scheduled",
    [SitePhase.Discovery]: "Discovery",
    [SitePhase.StandBy]: "Stand By",
    [SitePhase.Active]: "Active",
    [SitePhase.Processing]: "Processing",
    [SitePhase.Complete]: "Complete",
    [SitePhase.NoData]: "No Data",
};

export interface FormatSiteStatusOptions {
    phase: SitePhase;
    fromMs?: number | undefined;
    toMs?: number | undefined;
}

/**
 * Formats a Site's status into a human-readable string for display in UI components.
 */
export const formatSiteStatus = ({
    phase,
    fromMs,
    toMs,
}: FormatSiteStatusOptions): string => {
    const hasRange = fromMs !== undefined && toMs !== undefined;

    if (phase === SitePhase.Scheduled || phase === SitePhase.Discovery) {
        return hasRange ? `Starts in ${formatDuration(fromMs, toMs)}` : "Starts soon";
    }

    if (phase === SitePhase.StandBy) {
        return hasRange ? `Stand By · ${formatDuration(fromMs, toMs)}` : "Stand By";
    }

    if (phase === SitePhase.Active) {
        return hasRange ? `Active · ${formatDuration(fromMs, toMs)}` : "Active";
    }

    return PhaseDisplayNames[phase] || "Unknown";
};
