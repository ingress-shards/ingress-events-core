/**
 * Ingress Ornament SVG Template.
 *
 * @param color - The primary stroke and background color for the ornament.
 * @returns A string containing the SVG HTML.
 */
export const getOrnamentSVG = (color: string): string => `
    <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" style="display: block;">
        <polygon points="15,2 27,8.5 27,21.5 15,28 3,21.5 3,8.5" 
                 fill="${color}" fill-opacity="0.1" 
                 stroke="${color}" stroke-width="2" 
                 stroke-linejoin="round" />
    </svg>`;
