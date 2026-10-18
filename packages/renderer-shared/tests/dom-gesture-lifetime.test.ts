// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Config, CoordinateTransformer, ViewportState } from "@canvas-tile-engine/core";
import { Camera } from "../../core/src/modules/Camera";
import { RendererCanvas } from "../../renderer-canvas/src/RendererCanvas";
import { RendererWebGL } from "../../renderer-webgl/src/RendererWebGL";

// Exercise each real DOM adapter and its real gesture processor. GPU drawing
// is irrelevant to input lifetime, so only the GL resource backend is mocked.
vi.mock("../../renderer-webgl/src/modules/gl/GLRenderer", () => ({
    GLRenderer: class {
        setSize() {}
        dispose() {}
    },
}));

describe.each([
    ["Canvas2D", RendererCanvas],
    ["WebGL", RendererWebGL],
] as const)("%s DOM gesture lifetime", (_name, Renderer) => {
    let renderer: RendererCanvas | RendererWebGL;
    let wrapper: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    let camera: Camera;
    let config: Config;

    function mouse(target: EventTarget, type: string, x = 30, y = 40, buttons = 1): void {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons }));
    }

    function touch(type: string, remaining: number[], changed: number[], foreign: number[] = []): TouchEvent {
        const contact = (id: number): Touch => ({ identifier: id, clientX: id * 20, clientY: 40 }) as Touch;
        const event = new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: [...remaining, ...foreign].map(contact),
            targetTouches: remaining.map(contact),
            changedTouches: changed.map(contact),
        });
        canvas.dispatchEvent(event);
        return event;
    }

    beforeEach(() => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            setTransform: vi.fn(),
        } as unknown as CanvasRenderingContext2D);
        wrapper = document.createElement("div");
        canvas = document.createElement("canvas");
        wrapper.append(canvas);
        document.body.append(wrapper);
        vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 100, 100));
        const viewport = new ViewportState(100, 100);
        camera = new Camera({ x: -0.5, y: -0.5 }, 1, 0.1, 10);
        config = new Config({
            scale: 1,
            size: { width: 100, height: 100 },
            eventHandlers: { drag: true, click: true, zoom: true, hover: true },
        });
        renderer = new Renderer();
        renderer.init({ wrapper, camera, config, viewport, transformer: new CoordinateTransformer(camera) });
        renderer.setupEvents();
        renderer.onMouseDown = vi.fn();
        renderer.onMouseUp = vi.fn();
        renderer.onMouseLeave = vi.fn();
        renderer.onHover = vi.fn();
        renderer.onClick = vi.fn();
        renderer.onCameraChange = vi.fn();
    });

    afterEach(() => {
        renderer.destroy();
        wrapper.remove();
        vi.restoreAllMocks();
    });

    it("continues panning outside, re-enters without a jump and releases once", () => {
        mouse(canvas, "mousedown");
        mouse(canvas, "mouseleave", 110, 40);
        expect(renderer.onMouseLeave).toHaveBeenCalledTimes(1);
        mouse(document.body, "mousemove", 130, 60);
        expect(camera.x).toBe(-100);
        expect(camera.y).toBe(-20);
        mouse(canvas, "mousemove", 100, 50);
        expect(camera.x).toBe(-70);
        expect(camera.y).toBe(-10);
        mouse(document.body, "mouseup", 140, 60, 0);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        expect(renderer.onMouseUp).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ raw: { x: 130, y: 40 } }),
            expect.objectContaining({ raw: { x: 140, y: 60 } }),
        );
        mouse(canvas, "click", 100, 50, 0);
        expect(renderer.onClick).not.toHaveBeenCalled();
        mouse(document, "mousemove", 300, 300);
        expect(camera.x).toBe(-70);
        expect(renderer.onCameraChange).toHaveBeenCalledTimes(2);
    });

    it("keeps hover local and delivers a normal click after an interrupted drag", () => {
        mouse(canvas, "mousedown");
        window.dispatchEvent(new Event("blur"));
        mouse(canvas, "mouseup", 30, 40, 0);
        mouse(canvas, "click", 30, 40, 0);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        expect(renderer.onClick).not.toHaveBeenCalled();
        config.updateEventHandlers({ drag: false });
        mouse(canvas, "mousedown");
        mouse(document, "mousemove", 140, 50);
        expect(renderer.onHover).not.toHaveBeenCalled();
        mouse(canvas, "mouseup", 30, 40, 0);
        mouse(canvas, "click", 30, 40, 0);
        expect(renderer.onClick).toHaveBeenCalledTimes(1);
        expect(camera.x).toBe(0);
    });

    it("delivers captured drag and hover once inside a closed shadow root", () => {
        const host = document.createElement("div");
        document.body.append(host);
        host.attachShadow({ mode: "closed" }).append(wrapper);
        const dispatch = (type: string, x: number): void => {
            canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, buttons: 1, clientX: x }));
        };
        dispatch("mousedown", 30);
        dispatch("mousemove", 40);
        dispatch("mouseup", 40);
        expect(renderer.onCameraChange).toHaveBeenCalledTimes(1);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        config.updateEventHandlers({ drag: false });
        dispatch("mousedown", 30);
        dispatch("mousemove", 40);
        dispatch("mouseup", 40);
        expect(renderer.onHover).toHaveBeenCalledTimes(1);
        host.remove();
    });

    it("cancels a touch tap without clicking and allows the next tap", () => {
        touch("touchstart", [1], [1]);
        touch("touchcancel", [], [1]);
        touch("touchend", [], [1]);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        expect(renderer.onClick).not.toHaveBeenCalled();
        touch("touchstart", [1], [1]);
        touch("touchend", [], [1]);
        expect(renderer.onMouseDown).toHaveBeenCalledTimes(2);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(2);
        expect(renderer.onClick).toHaveBeenCalledTimes(1);
    });

    it("clears partial pinch cancellation and ignores remaining finger moves/releases", () => {
        touch("touchstart", [1], [1]);
        touch("touchstart", [1, 3], [3]);
        touch("touchcancel", [3], [1]);
        touch("touchmove", [4], [4]);
        touch("touchend", [], [3]);
        expect(camera.x).toBe(0);
        expect(camera.scale).toBe(1);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        expect(renderer.onClick).not.toHaveBeenCalled();
        touch("touchstart", [1], [1]);
        touch("touchmove", [2], [2]);
        touch("touchend", [], [2]);
        expect(camera.x).toBe(-20);
        expect(renderer.onClick).not.toHaveBeenCalled();
    });

    it("ignores other elements' touches when deciding whether this gesture is a tap", () => {
        touch("touchstart", [1], [1], [10]);
        touch("touchend", [], [1], [10]);
        expect(renderer.onMouseDown).toHaveBeenCalledTimes(1);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        expect(renderer.onClick).toHaveBeenCalledTimes(1);
        expect(camera.scale).toBe(1);
    });

    it("preserves browser scrolling when all touch interactions are disabled", () => {
        config.updateEventHandlers({ drag: false, click: false, zoom: false, hover: false });
        expect(touch("touchstart", [1], [1]).defaultPrevented).toBe(false);
        expect(touch("touchmove", [2], [2]).defaultPrevented).toBe(false);
        touch("touchcancel", [], [2]);
        expect(renderer.onMouseDown).not.toHaveBeenCalled();
        expect(renderer.onMouseUp).not.toHaveBeenCalled();
        expect(renderer.onClick).not.toHaveBeenCalled();
    });

    it("cancels active input on destroy without retaining document listeners", () => {
        mouse(canvas, "mousedown");
        renderer.destroy();
        mouse(document, "mousemove", 150, 70);
        mouse(document, "mouseup", 150, 70, 0);
        mouse(canvas, "click", 30, 40, 0);
        expect(renderer.onMouseUp).toHaveBeenCalledTimes(1);
        expect(renderer.onClick).not.toHaveBeenCalled();
        expect(renderer.onCameraChange).not.toHaveBeenCalled();
        expect(camera.x).toBe(0);
    });
});
