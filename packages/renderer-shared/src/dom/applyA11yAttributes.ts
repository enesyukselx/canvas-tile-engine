import { AccessibilityConfig, AccessibilityRole } from "@canvas-tile-engine/core";

/** Web ARIA role for each engine role. `"image"` maps to ARIA's `img`. */
const ARIA_ROLE: Record<AccessibilityRole, string> = {
    region: "region",
    image: "img",
    application: "application",
};

/** Class the focus outline rule is scoped to. */
const FOCUS_CLASS = "cte-a11y-surface";
const STYLE_ID = "cte-a11y-style";

/**
 * A focus ring that survives a global `outline: none` reset. Without it an app
 * with such a reset gets an invisible tab stop, which is worse than no tab
 * stop at all (WCAG 2.4.7).
 */
const FOCUS_STYLE = `.${FOCUS_CLASS}:focus-visible{outline:2px solid Highlight;outline:2px solid -webkit-focus-ring-color;outline-offset:2px;}`;

let descriptionSeq = 0;

/**
 * Writes the accessibility attributes for a canvas surface and returns a
 * teardown.
 *
 * The wrapper carries the identity, never a canvas: `initStyles` gives the
 * wrapper `overflow: hidden`, so a focus ring drawn on a canvas would be
 * clipped away; both DOM renderers can adopt an app-authored canvas, so "the
 * canvas" is ambiguous; and the WebGL renderer has two of them, which would
 * put two junk graphics nodes in the accessibility tree. Every managed canvas
 * is hidden from assistive technology instead.
 *
 * An attribute the app already set is never overwritten — only attributes this
 * module wrote itself are updated or removed.
 * @internal
 */
export class A11yAttributes {
    /** Attributes this module owns; anything else on the wrapper is the app's. */
    private owned = new Set<string>();
    private descriptionNode?: HTMLElement;
    private addedFocusClass = false;

    constructor(
        private wrapper: HTMLElement,
        private canvases: HTMLCanvasElement[],
    ) {}

    /** Apply (or re-apply) attributes for the given preferences. */
    apply(accessibility: AccessibilityConfig) {
        this.ensureFocusStyle();

        if (!this.addedFocusClass) {
            this.wrapper.classList.add(FOCUS_CLASS);
            this.addedFocusClass = true;
        }

        this.setOrClear("tabindex", accessibility.focusable ? "0" : undefined);
        this.setOrClear("aria-label", accessibility.label);
        this.setOrClear("role", accessibility.role ? ARIA_ROLE[accessibility.role] : undefined);
        this.applyDescription(accessibility.description);

        for (const canvas of this.canvases) {
            // Fallback content inside a canvas is the app's own accessible
            // alternative — hiding it would silently discard that.
            if (canvas.childNodes.length === 0 && !canvas.hasAttribute("aria-hidden")) {
                canvas.setAttribute("aria-hidden", "true");
                canvas.dataset.cteA11yHidden = "true";
            }
        }
    }

    /** Remove everything this module added, leaving app-set attributes alone. */
    destroy() {
        for (const name of this.owned) {
            this.wrapper.removeAttribute(name);
        }
        this.owned.clear();

        if (this.addedFocusClass) {
            this.wrapper.classList.remove(FOCUS_CLASS);
            this.addedFocusClass = false;
        }

        this.descriptionNode?.remove();
        this.descriptionNode = undefined;

        for (const canvas of this.canvases) {
            if (canvas.dataset.cteA11yHidden === "true") {
                canvas.removeAttribute("aria-hidden");
                delete canvas.dataset.cteA11yHidden;
            }
        }
    }

    /**
     * Write an attribute we own, or skip it entirely when the app set its own.
     * `undefined` clears ours without touching the app's.
     */
    private setOrClear(name: string, value: string | undefined) {
        const isOurs = this.owned.has(name);
        if (!isOurs && this.wrapper.hasAttribute(name)) {
            return; // the app owns it
        }

        if (value === undefined) {
            if (isOurs) {
                this.wrapper.removeAttribute(name);
                this.owned.delete(name);
            }
            return;
        }

        this.wrapper.setAttribute(name, value);
        this.owned.add(name);
    }

    private applyDescription(description: string | undefined) {
        if (description === undefined) {
            this.descriptionNode?.remove();
            this.descriptionNode = undefined;
            this.setOrClear("aria-describedby", undefined);
            return;
        }

        if (!this.descriptionNode) {
            const node = this.wrapper.ownerDocument.createElement("span");
            node.id = `cte-a11y-desc-${++descriptionSeq}`;
            // Visually hidden but still announced.
            Object.assign(node.style, {
                position: "absolute",
                width: "1px",
                height: "1px",
                margin: "-1px",
                padding: "0",
                border: "0",
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
                whiteSpace: "nowrap",
            });
            this.wrapper.appendChild(node);
            this.descriptionNode = node;
        }

        this.descriptionNode.textContent = description;
        this.setOrClear("aria-describedby", this.descriptionNode.id);
    }

    /** One shared stylesheet per document, kept even after teardown. */
    private ensureFocusStyle() {
        const doc = this.wrapper.ownerDocument;
        if (!doc || doc.getElementById(STYLE_ID)) {
            return;
        }
        const style = doc.createElement("style");
        style.id = STYLE_ID;
        style.textContent = FOCUS_STYLE;
        doc.head.appendChild(style);
    }
}
