/**
 * Renders a flag-icons CSS span for an ISO 3166-1 alpha-2 country code.
 * Progressively enhances in hosts that load flag-icons CSS and degrades to an empty 0x0 span otherwise.
 */
export const renderFlagIcon = (countryCode?: string): string => {
    const normalizedCode = countryCode?.trim().toLowerCase();
    if (!normalizedCode) return "";
    return `<span class="fi fi-${normalizedCode}"></span>`;
};
