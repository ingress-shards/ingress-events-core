import { describe, it, expect } from "vitest";
import { renderSiteMarker } from "./SiteMarker.js";

describe("SiteMarker", () => {
    it("renders tactical marker SVG with CSS variables, pearl bead gradient, and zero inline styles", () => {
        const svg = renderSiteMarker();

        expect(svg).toContain('class="marker-svg-pin"');
        expect(svg).toContain('fill="var(--pin-color, var(--color-nodata, #777777))"');
        expect(svg).toContain('class="marker-pin-satin"');
        expect(svg).toContain('id="innerBead"');
        expect(svg).not.toContain("style=");
    });

    it("applies custom fallback body color when provided", () => {
        const svg = renderSiteMarker("#ffcc00");

        expect(svg).toContain('fill="var(--pin-color, #ffcc00)"');
    });
});
