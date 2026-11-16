const FALLBACK_LOCALE = "en-GB";
let configuredLocale: string | undefined;

/**
 * Returns the browser's preferred locale, falling back to "en-GB".
 */
export const getDefaultLocale = (): string =>
    typeof navigator === "undefined" ? FALLBACK_LOCALE : (navigator.language || FALLBACK_LOCALE);

/**
 * Returns the active locale (configured override or browser default).
 */
export const getLocale = (): string => configuredLocale ?? getDefaultLocale();

/**
 * Sets a global locale override, or resets to auto-detection when omitted.
 */
export const setLocale = (locale?: string): void => {
    configuredLocale = locale;
};

/**
 * Resolves an explicit locale override or falls back to the active locale.
 */
export const resolveLocale = (locale?: string): string => locale ?? getLocale();
