/**
 * Premium Tactical Pin SVG Template.
 *
 * This SVG is designed to be styled via CSS variables:
 * --pin-color: The main body color of the pin.
 * --pin-inner-color: The color of the inner pearl/bead.
 */
export const TACTICAL_MARKER_SVG = `
    <svg class="marker-svg-pin" width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- Satin Body Overlay: Smoother transitions to avoid "two-tone" harshness -->
            <linearGradient id="pinSatin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6" />
                <stop offset="20%" stop-color="#ffffff" stop-opacity="0.2" />
                <stop offset="50%" stop-color="#ffffff" stop-opacity="0" />
                <stop offset="80%" stop-color="#000000" stop-opacity="0.1" />
                <stop offset="100%" stop-color="#000000" stop-opacity="0.4" />
            </linearGradient>

            <!-- Premium Pearl/Satin Inner Bead -->
            <radialGradient id="innerBead" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="50%" stop-color="#f0f0f0" />
                <stop offset="100%" stop-color="#999999" />
            </radialGradient>
        </defs>
        
        <!-- Main Shape Layer (Colored via CSS --pin-color) -->
        <path class="marker-pin-body" d="M 12.5 41 L 1.7 18.75 A 12.5 12.5 0 1 1 23.3 18.75 Z" fill="var(--pin-color, var(--shards-nodata-color, #777777))" stroke="rgba(0,0,0,0.25)" stroke-width="0.5" />
        
        <!-- Gloss/Satin Overlay -->
        <path d="M 12.5 41 L 1.7 18.75 A 12.5 12.5 0 1 1 23.3 18.75 Z" fill="url(#pinSatin)" style="pointer-events: none;" />
        
        <!-- Inner "Socket" Depth -->
        <circle cx="12.5" cy="12.5" r="5.5" fill="rgba(0,0,0,0.15)" stroke="none" />
        
        <!-- The Inner Satin Bead -->
        <circle class="marker-pin-inner" cx="12.5" cy="12.5" r="4.5" fill="url(#innerBead)" stroke="rgba(0,0,0,0.2)" stroke-width="0.4" />
    </svg>`;
