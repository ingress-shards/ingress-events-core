import type { SiteId } from "../../common/Identifiers.js";
import type { SiteState } from "../../sites/Site.js";

export type TooltipContentResolver = (trigger: HTMLElement) => Promise<string | undefined> | string | undefined;
export type TooltipResolverMap = Record<string, TooltipContentResolver>;
export type SiteStateLookup = (siteId: SiteId) => Promise<SiteState | undefined> | SiteState | undefined;

const positionOverlay = (overlay: HTMLDivElement, trigger: HTMLElement, event: MouseEvent): void => {
    let x = event.pageX;
    let y = event.pageY;
    if (!x && !y) {
        const rect = trigger.getBoundingClientRect();
        x = rect.left + rect.width / 2 + window.scrollX;
        y = rect.top + window.scrollY;
    }

    const width = overlay.offsetWidth || 200;
    const height = overlay.offsetHeight || 100;
    const padding = 8;

    let left = x - width / 2;
    let top = y - height - 15;

    const maxLeft = window.scrollX + window.innerWidth - width - padding;
    if (left > maxLeft) left = maxLeft;
    if (left < window.scrollX + padding) left = window.scrollX + padding;
    if (top < window.scrollY + padding) top = y + 20;

    overlay.style.left = `${Math.round(left)}px`;
    overlay.style.top = `${Math.round(top)}px`;
};

/**
 * Binds delegated hover and click handlers on `root` for `[data-tooltip-type]` triggers,
 * rendering resolved tooltip HTML inside a floating `.tooltip-overlay` on `document.body`.
 * Returns a cleanup function that removes the listeners and overlay element.
 */
export const bindTooltips = (
    resolver: TooltipContentResolver | TooltipResolverMap,
    root: Document | HTMLElement = document,
): (() => void) => {
    let overlay: HTMLDivElement | undefined;
    let activeTrigger: HTMLElement | undefined;

    const getOverlay = (): HTMLDivElement => {
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "tooltip-overlay";
            document.body.appendChild(overlay);
        }
        return overlay;
    };

    const show = async (trigger: HTMLElement, event: MouseEvent) => {
        if (activeTrigger === trigger && overlay?.classList.contains("visible")) return;

        const resolve = typeof resolver === "function"
            ? resolver
            : resolver[trigger.dataset.tooltipType ?? ""];
        if (!resolve) return;

        const html = await resolve(trigger);
        if (!html) return;

        const element = getOverlay();
        element.innerHTML = html;
        activeTrigger = trigger;
        positionOverlay(element, trigger, event);
        element.classList.add("visible");
    };

    const hide = () => {
        overlay?.classList.remove("visible");
        activeTrigger = undefined;
    };

    const onMouseEnter = (event: Event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.matches("[data-tooltip-type]")) {
            void show(target, event as MouseEvent);
        }
    };

    const onMouseLeave = (event: Event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.matches("[data-tooltip-type]")) {
            hide();
        }
    };

    const onClick = (event: Event) => {
        const target = event.target as Element | null;
        const trigger = target?.closest?.("[data-tooltip-type]");
        if (trigger instanceof HTMLElement) {
            event.stopPropagation();
            if (activeTrigger === trigger && overlay?.classList.contains("visible")) {
                hide();
            } else {
                void show(trigger, event as MouseEvent);
            }
            return;
        }

        if (!target?.closest?.(".tooltip-overlay")) {
            hide();
        }
    };

    root.addEventListener("mouseenter", onMouseEnter, { capture: true });
    root.addEventListener("mouseleave", onMouseLeave, { capture: true });
    root.addEventListener("click", onClick);

    return () => {
        root.removeEventListener("mouseenter", onMouseEnter, { capture: true });
        root.removeEventListener("mouseleave", onMouseLeave, { capture: true });
        root.removeEventListener("click", onClick);
        overlay?.remove();
        overlay = undefined;
        activeTrigger = undefined;
    };
};
