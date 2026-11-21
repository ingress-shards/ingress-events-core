import { FACTION_IDS, type FactionId } from "../../common/Alignment.js";
import type { ConfigRegistry } from "../../config/ConfigRegistry.js";
import type { SiteConfig } from "../../config/SiteConfig.js";
import type { SiteState, WaveState } from "../../sites/Site.js";
import type { SeasonEvent } from "../../types/index.js";
import type { SiteStateLookup } from "./TooltipHost.js";

export interface SiteTooltipContext {
    siteConfig: SiteConfig;
    siteState?: SiteState | undefined;
    seasonEvent?: SeasonEvent | undefined;
}

export interface WaveTooltipContext extends SiteTooltipContext {
    siteState: SiteState;
    waveNum: number;
    waveState: WaveState;
}

export interface FactionWaveTooltipContext extends WaveTooltipContext {
    faction: FactionId;
}

const parseFaction = (value: string | undefined): FactionId | undefined =>
    FACTION_IDS.find((factionId) => factionId === value);

/**
 * Validates `trigger.dataset.siteId` and resolves site configuration and optional `SiteState`.
 */
export const resolveSiteContext = async (
    trigger: HTMLElement,
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): Promise<SiteTooltipContext | undefined> => {
    const { siteId } = trigger.dataset;
    if (!siteId) return;

    const siteConfig = configRegistry.getSiteConfig(siteId);
    if (!siteConfig) return;

    const siteState = await getSiteState(siteId);
    const season = configRegistry.getSeasonMetadata(siteConfig.seasonId);
    const seasonEvent = season?.events.find((eventItem) => eventItem.eventType === siteConfig.geocode.eventType);

    return {
        siteConfig,
        siteState,
        seasonEvent,
    };
};

/**
 * Validates `trigger.dataset.siteId` and `trigger.dataset.wave` and resolves the matching `WaveState`.
 */
export const resolveWaveContext = async (
    trigger: HTMLElement,
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): Promise<WaveTooltipContext | undefined> => {
    const { wave } = trigger.dataset;
    const waveNum = Number(wave);
    if (!wave || Number.isNaN(waveNum)) return;

    const base = await resolveSiteContext(trigger, configRegistry, getSiteState);
    if (!base?.siteState) return;

    const waveState = base.siteState.analysis?.waves[waveNum];
    if (!waveState) return;

    return {
        ...base,
        siteState: base.siteState,
        waveNum,
        waveState,
    };
};

/**
 * Validates `trigger.dataset.faction` alongside site and wave context for faction scoring tooltips.
 */
export const resolveFactionWaveContext = async (
    trigger: HTMLElement,
    configRegistry: ConfigRegistry,
    getSiteState: SiteStateLookup,
): Promise<FactionWaveTooltipContext | undefined> => {
    const faction = parseFaction(trigger.dataset.faction);
    if (!faction) return;

    const context = await resolveWaveContext(trigger, configRegistry, getSiteState);
    if (!context) return;

    return {
        ...context,
        faction,
    };
};
