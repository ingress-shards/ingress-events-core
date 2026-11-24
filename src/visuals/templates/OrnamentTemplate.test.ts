import { describe, it, expect } from "vitest";
import { renderOrnamentIcon, renderOrnamentPortal } from "./OrnamentTemplate.js";

describe("OrnamentTemplate", () => {
    it("renders plain ornament hexagon without inline styles or inner portal circle", () => {
        const defaultSvg = renderOrnamentIcon();
        expect(defaultSvg).toContain('class="marker-svg-ornament"');
        expect(defaultSvg).toContain('fill="var(--ornament-color, var(--color-signal))"');
        expect(defaultSvg).not.toContain("<circle");
        expect(defaultSvg).not.toContain("style=");

        const coloredSvg = renderOrnamentIcon("#ffcc00");
        expect(coloredSvg).toContain('fill="var(--ornament-color, #ffcc00)"');
        expect(coloredSvg).toContain('stroke="var(--ornament-color, #ffcc00)"');
    });

    it("renders ornament portal SVG with classes, geometry, and default portal color", () => {
        const svg = renderOrnamentPortal("#ffcc00");

        expect(svg).toContain('class="marker-svg-ornament-portal"');
        expect(svg).toContain('class="ornament-hexagon"');
        expect(svg).toContain('class="ornament-portal-dot"');
        expect(svg).toContain('cx="15" cy="15" r="4.5"');
        expect(svg).toContain('fill="var(--portal-color, #bdbdbd)"');
        expect(svg).not.toContain("style=");
    });

    it("applies custom portal color fallback in renderOrnamentPortal", () => {
        const svg = renderOrnamentPortal("#ffcc00", "#0088ff");

        expect(svg).toContain('fill="var(--portal-color, #0088ff)"');
        expect(svg).toContain('stroke="var(--portal-color, #0088ff)"');
    });
});
