import { describe, it, expect, beforeEach, vi } from "vitest";
import { bindTooltips, type TooltipContentResolver } from "./TooltipHost.js";

describe("bindTooltips", () => {
    let createdOverlay: {
        className: string;
        innerHTML: string;
        style: Record<string, string>;
        classList: { add: (...c: string[]) => void; remove: (...c: string[]) => void; contains: (c: string) => boolean };
        offsetWidth: number;
        offsetHeight: number;
        remove: ReturnType<typeof vi.fn>;
    };
    const listeners = new Map<string, (event: unknown) => void>();

    beforeEach(() => {
        listeners.clear();
        const classes = new Set<string>();
        createdOverlay = {
            className: "",
            innerHTML: "",
            style: {},
            offsetWidth: 200,
            offsetHeight: 100,
            remove: vi.fn(),
            classList: {
                add: (...c: string[]) => {
                    for (const item of c) classes.add(item);
                },
                remove: (...c: string[]) => {
                    for (const item of c) classes.delete(item);
                },
                contains: (c: string) => classes.has(c),
            },
        };

        class MockHTMLElement {
            public dataset: Record<string, string> = {};
            public matches(selector: string): boolean {
                return selector === "[data-tooltip-type]" && Boolean(this.dataset.tooltipType);
            }
        }
        vi.stubGlobal("HTMLElement", MockHTMLElement);
        vi.stubGlobal("window", { innerWidth: 1024, scrollX: 0, scrollY: 0 });
        vi.stubGlobal("document", {
            createElement: () => createdOverlay,
            body: { appendChild: vi.fn() },
            addEventListener: (type: string, handler: (event: unknown) => void) => {
                listeners.set(type, handler);
            },
            removeEventListener: vi.fn(),
        });
    });

    it("renders resolved tooltip HTML on click, clamps to viewport, and hides on outside click", async () => {
        const unbind = bindTooltips(() => '<div class="tooltip tooltip-wave">Wave 1</div>');

        const trigger = Object.assign(Object.create(HTMLElement.prototype) as HTMLElement, {
            dataset: { tooltipType: "wave" },
            getBoundingClientRect: () => ({ left: 10, top: 10, width: 20, height: 20 }),
        });

        const clickHandler = listeners.get("click")!;
        clickHandler({
            target: { closest: (sel: string) => (sel === "[data-tooltip-type]" ? trigger : undefined) },
            stopPropagation: vi.fn(),
            pageX: 10,
            pageY: 10,
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(createdOverlay).toHaveProperty("innerHTML", '<div class="tooltip tooltip-wave">Wave 1</div>');
        expect(createdOverlay.classList.contains("visible")).toBe(true);
        expect(createdOverlay.style.left).toBe("8px");
        expect(createdOverlay.style.top).toBe("30px");

        clickHandler({
            target: { closest: () => undefined },
            stopPropagation: vi.fn(),
        });
        expect(createdOverlay.classList.contains("visible")).toBe(false);

        unbind();
        expect(createdOverlay.remove).toHaveBeenCalled();
    });

    it("dispatches by data-tooltip-type when passed a resolver map and ignores unknown types", async () => {
        const waveResolver = vi.fn<TooltipContentResolver>(() => '<div class="tooltip tooltip-wave">Wave 2</div>');
        const goalsResolver = vi.fn<TooltipContentResolver>(() => '<div class="tooltip tooltip-goals">Goals</div>');
        const unbind = bindTooltips({ wave: waveResolver, goals: goalsResolver });

        const waveTrigger = Object.assign(Object.create(HTMLElement.prototype) as HTMLElement, {
            dataset: { tooltipType: "wave" },
            getBoundingClientRect: () => ({ left: 20, top: 20, width: 20, height: 20 }),
        });
        const unknownTrigger = Object.assign(Object.create(HTMLElement.prototype) as HTMLElement, {
            dataset: { tooltipType: "other" },
            getBoundingClientRect: () => ({ left: 20, top: 20, width: 20, height: 20 }),
        });

        const clickHandler = listeners.get("click")!;
        clickHandler({
            target: { closest: (sel: string) => (sel === "[data-tooltip-type]" ? unknownTrigger : undefined) },
            stopPropagation: vi.fn(),
            pageX: 20,
            pageY: 20,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(waveResolver).not.toHaveBeenCalled();
        expect(goalsResolver).not.toHaveBeenCalled();
        expect(createdOverlay.classList.contains("visible")).toBe(false);

        clickHandler({
            target: { closest: (sel: string) => (sel === "[data-tooltip-type]" ? waveTrigger : undefined) },
            stopPropagation: vi.fn(),
            pageX: 50,
            pageY: 50,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(waveResolver).toHaveBeenCalledTimes(1);
        expect(waveResolver.mock.calls[0]?.[0]).toBe(waveTrigger);
        expect(goalsResolver).not.toHaveBeenCalled();
        expect(createdOverlay).toHaveProperty("innerHTML", '<div class="tooltip tooltip-wave">Wave 2</div>');
        expect(createdOverlay.classList.contains("visible")).toBe(true);

        unbind();
    });

    it("triggers hover only on the [data-tooltip-type] element itself and ignores child spans", async () => {
        const waveResolver = vi.fn<TooltipContentResolver>(() => '<div class="tooltip tooltip-wave">Wave 1</div>');
        const unbind = bindTooltips({ wave: waveResolver });

        const trigger = Object.assign(Object.create(HTMLElement.prototype) as HTMLElement, {
            dataset: { tooltipType: "wave" },
            getBoundingClientRect: () => ({ left: 40, top: 40, width: 20, height: 20 }),
        });
        const innerSpan = Object.assign(Object.create(HTMLElement.prototype) as HTMLElement, {
            dataset: {},
        });

        const mouseEnter = listeners.get("mouseenter")!;
        const mouseLeave = listeners.get("mouseleave")!;

        mouseEnter({ target: trigger, pageX: 45, pageY: 45 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(waveResolver).toHaveBeenCalledTimes(1);
        expect(createdOverlay.classList.contains("visible")).toBe(true);

        mouseEnter({ target: innerSpan, pageX: 46, pageY: 46 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(waveResolver).toHaveBeenCalledTimes(1);
        expect(createdOverlay.classList.contains("visible")).toBe(true);

        mouseLeave({ target: innerSpan });
        expect(createdOverlay.classList.contains("visible")).toBe(true);

        mouseLeave({ target: trigger });
        expect(createdOverlay.classList.contains("visible")).toBe(false);

        unbind();
    });

    it("rounds overlay coordinates to whole pixels when offsetWidth is odd", async () => {
        createdOverlay.offsetWidth = 201;
        createdOverlay.offsetHeight = 101;
        const unbind = bindTooltips(() => '<div class="tooltip tooltip-wave">Wave 1</div>');

        const trigger = Object.assign(Object.create(HTMLElement.prototype) as HTMLElement, {
            dataset: { tooltipType: "wave" },
            getBoundingClientRect: () => ({ left: 200, top: 200, width: 20, height: 20 }),
        });

        listeners.get("mouseenter")!({ target: trigger, pageX: 300, pageY: 300 });
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(createdOverlay.style.left).toBe("200px");
        expect(createdOverlay.style.top).toBe("184px");

        unbind();
    });
});
