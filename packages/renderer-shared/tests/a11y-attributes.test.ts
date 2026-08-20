// @vitest-environment jsdom
//
// These are exactly the semantics a hand-rolled fake element cannot honestly
// test — hasAttribute, removeAttribute, appendChild and classList all have to
// be real, or the test just agrees with whatever we wrote.
import { afterEach, describe, expect, it } from "vitest";
import { A11yAttributes } from "../src/dom/applyA11yAttributes";

function createSurface(canvasCount = 1) {
    const wrapper = document.createElement("div");
    const canvases = Array.from({ length: canvasCount }, () => {
        const canvas = document.createElement("canvas");
        wrapper.appendChild(canvas);
        return canvas;
    });
    document.body.appendChild(wrapper);
    return { wrapper, canvases, a11y: new A11yAttributes(wrapper, canvases) };
}

afterEach(() => {
    document.body.innerHTML = "";
    document.getElementById("cte-a11y-style")?.remove();
});

describe("A11yAttributes", () => {
    it("names the wrapper and hides every managed canvas", () => {
        const { wrapper, canvases, a11y } = createSurface(2);

        a11y.apply({ focusable: true, label: "Seating chart", role: "region" });

        expect(wrapper.getAttribute("tabindex")).toBe("0");
        expect(wrapper.getAttribute("aria-label")).toBe("Seating chart");
        expect(wrapper.getAttribute("role")).toBe("region");
        for (const canvas of canvases) {
            expect(canvas.getAttribute("aria-hidden")).toBe("true");
        }
    });

    it('maps the "image" role to ARIA img', () => {
        const { wrapper, a11y } = createSurface();
        a11y.apply({ label: "Board", role: "image" });
        expect(wrapper.getAttribute("role")).toBe("img");
    });

    it("writes no name and no role when none is configured", () => {
        const { wrapper, a11y } = createSurface();

        a11y.apply({ focusable: false });

        expect(wrapper.hasAttribute("aria-label")).toBe(false);
        expect(wrapper.hasAttribute("role")).toBe(false);
        expect(wrapper.hasAttribute("tabindex")).toBe(false);
    });

    // The frozen rule: an attribute the app set is never touched.
    it("never overwrites an attribute the app already set", () => {
        const { wrapper, a11y } = createSurface();
        wrapper.setAttribute("aria-label", "App owns this");
        wrapper.setAttribute("tabindex", "-1");

        a11y.apply({ focusable: true, label: "Engine label", role: "region" });

        expect(wrapper.getAttribute("aria-label")).toBe("App owns this");
        expect(wrapper.getAttribute("tabindex")).toBe("-1");
        // role was not app-set, so the engine may write it.
        expect(wrapper.getAttribute("role")).toBe("region");

        a11y.destroy();
        expect(wrapper.getAttribute("aria-label")).toBe("App owns this");
        expect(wrapper.getAttribute("tabindex")).toBe("-1");
    });

    it("leaves a canvas with fallback content alone", () => {
        const { wrapper, a11y } = createSurface(0);
        const canvas = document.createElement("canvas");
        canvas.append(document.createTextNode("A map of the venue"));
        wrapper.appendChild(canvas);

        new A11yAttributes(wrapper, [canvas]).apply({ focusable: true });

        expect(canvas.hasAttribute("aria-hidden")).toBe(false);
        void a11y;
    });

    it("updates its own attributes on re-apply", () => {
        const { wrapper, a11y } = createSurface();
        a11y.apply({ focusable: true, label: "First", role: "region" });

        a11y.apply({ focusable: false, label: "Second", role: "region" });

        expect(wrapper.getAttribute("aria-label")).toBe("Second");
        expect(wrapper.hasAttribute("tabindex")).toBe(false);
    });

    it("adds, updates and removes the description node", () => {
        const { wrapper, a11y } = createSurface();

        a11y.apply({ focusable: true, description: "Arrow keys pan the map" });
        const id = wrapper.getAttribute("aria-describedby");
        expect(id).toBeTruthy();
        const node = document.getElementById(id!);
        expect(node?.textContent).toBe("Arrow keys pan the map");
        expect(node?.style.position).toBe("absolute");

        a11y.apply({ focusable: true, description: "Updated help" });
        expect(document.getElementById(id!)?.textContent).toBe("Updated help");

        a11y.apply({ focusable: true });
        expect(wrapper.hasAttribute("aria-describedby")).toBe(false);
        expect(document.getElementById(id!)).toBeNull();
    });

    it("ships a focus-visible outline so a global outline reset cannot hide the tab stop", () => {
        const { wrapper, a11y } = createSurface();

        a11y.apply({ focusable: true });

        expect(wrapper.hasAttribute("data-cte-a11y-surface")).toBe(true);
        const style = document.getElementById("cte-a11y-style");
        expect(style?.textContent).toContain("[data-cte-a11y-surface]:focus-visible");
    });

    it("hooks the outline to an attribute React does not own, so a className change cannot drop it", () => {
        const { wrapper, a11y } = createSurface();

        a11y.apply({ focusable: true });
        // What React does on every `className` prop change.
        wrapper.className = "app-supplied";

        expect(wrapper.hasAttribute("data-cte-a11y-surface")).toBe(true);
    });

    it("removes only what it added", () => {
        const { wrapper, canvases, a11y } = createSurface();
        wrapper.setAttribute("data-app", "keep me");

        a11y.apply({ focusable: true, label: "Board", role: "region", description: "help" });
        a11y.destroy();

        expect(wrapper.hasAttribute("tabindex")).toBe(false);
        expect(wrapper.hasAttribute("aria-label")).toBe(false);
        expect(wrapper.hasAttribute("role")).toBe(false);
        expect(wrapper.hasAttribute("aria-describedby")).toBe(false);
        expect(wrapper.hasAttribute("data-cte-a11y-surface")).toBe(false);
        expect(wrapper.getAttribute("data-app")).toBe("keep me");
        expect(canvases[0].hasAttribute("aria-hidden")).toBe(false);
        expect(wrapper.querySelectorAll("span").length).toBe(0);
    });
});
