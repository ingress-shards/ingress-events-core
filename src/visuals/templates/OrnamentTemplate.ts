const ORNAMENT_HEXAGON_POINTS = "15,2 27,8.5 27,21.5 15,28 3,21.5 3,8.5";

/**
 * Ingress Ornament SVG Template.
 *
 * @param color - Fallback stroke and fill color (overridable via --ornament-color).
 * @returns A string containing the SVG HTML.
 */
export const renderOrnamentIcon = (color: string = "var(--color-signal)"): string => `
    <svg class="marker-svg-ornament" width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <polygon class="ornament-hexagon" points="${ORNAMENT_HEXAGON_POINTS}"
                 fill="var(--ornament-color, ${color})"
                 stroke="var(--ornament-color, ${color})" />
    </svg>`;

/**
 * Combined ornament ring and interactive center portal dot SVG template for standalone map layers.
 *
 * @param ornamentColor - Fallback stroke and fill color for the ornament ring (overridable via --ornament-color).
 * @param portalColor - Fallback fill and stroke color for the center portal dot (overridable via --portal-color).
 * @returns A string containing the SVG HTML.
 */
export const renderOrnamentPortal = (
    ornamentColor: string = "var(--color-signal)",
    portalColor: string = "#bdbdbd",
): string => `
    <svg class="marker-svg-ornament-portal" width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <polygon class="ornament-hexagon" points="${ORNAMENT_HEXAGON_POINTS}"
                 fill="var(--ornament-color, ${ornamentColor})"
                 stroke="var(--ornament-color, ${ornamentColor})" />
        <circle class="ornament-portal-dot" cx="15" cy="15" r="4.5"
                fill="var(--portal-color, ${portalColor})"
                stroke="var(--portal-color, ${portalColor})" />
    </svg>`;
