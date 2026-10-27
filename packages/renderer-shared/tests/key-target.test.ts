// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Config, CoordinateTransformer, ViewportState } from "@canvas-tile-engine/core";
import { Camera } from "../../core/src/modules/Camera";
import { RendererCanvas } from "../../renderer-canvas/src/RendererCanvas";
import { RendererWebGL } from "../../renderer-webgl/src/RendererWebGL";

// Real DOM adapters and gesture processor, so the keydown path runs exactly as
// in a browser. Only the GL resource backend is mocked.
vi.mock("../../renderer-webgl/src/modules/gl/GLRenderer", () => ({
    GLRenderer: class {
        setSize() {}
        dispose() {}
    },
}));

describe.each([
    ["Canvas2D", RendererCanvas],
    ["WebGL", RendererWebGL],
] as const)("%s keyboard target", (_name, Renderer) => {
    let renderer: RendererCanvas | RendererWebGL;
    let wrapper: HTMLDivElement;
    let camera: Camera;

    function press(target: EventTarget, key: string): KeyboardEvent {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
    }

    function cameraState() {
        return { x: camera.x, y: camera.y, scale: camera.scale };
    }

    beforeEach(() => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            setTransform: vi.fn(),
        } as unknown as CanvasRenderingContext2D);
        wrapper = document.createElement("div");
        const canvas = document.createElement("canvas");
        wrapper.append(canvas);
        document.body.append(wrapper);
        vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 100, 100));
        const viewport = new ViewportState(100, 100);
        camera = new Camera({ x: -0.5, y: -0.5 }, 1, 0.1, 10);
        const config = new Config({
            scale: 1,
            size: { width: 100, height: 100 },
            eventHandlers: { drag: true, click: true, zoom: true },
        });
        renderer = new Renderer();
        renderer.init({ wrapper, camera, config, viewport, transformer: new CoordinateTransformer(camera) });
        renderer.setupEvents();
        renderer.onClick = vi.fn();
        renderer.onCameraChange = vi.fn();
    });

    afterEach(() => {
        renderer.destroy();
        wrapper.remove();
        vi.restoreAllMocks();
    });

    it("handles keys pressed on the surface itself", () => {
        const before = cameraState();

        const pan = press(wrapper, "ArrowLeft");
        const activate = press(wrapper, "Enter");

        expect(camera.x).not.toBe(before.x);
        expect(pan.defaultPrevented).toBe(true);
        expect(renderer.onClick).toHaveBeenCalledOnce();
        expect(activate.defaultPrevented).toBe(true);
    });

    // In vanilla JS the wrapper is the app's own element and often holds
    // overlays. Key events bubble, so without a target check the map would
    // swallow what the user types into them.
    it("leaves keys typed into an input inside the wrapper to the input", () => {
        const input = document.createElement("input");
        wrapper.append(input);
        const before = cameraState();

        const events = [" ", "-", "+", "ArrowLeft", "ArrowUp", "Enter"].map((key) => press(input, key));

        expect(cameraState()).toEqual(before);
        expect(renderer.onClick).not.toHaveBeenCalled();
        expect(renderer.onCameraChange).not.toHaveBeenCalled();
        expect(events.map((event) => event.defaultPrevented)).toEqual(events.map(() => false));
    });

    it("lets a button inside the wrapper keep its own Enter and Space", () => {
        const button = document.createElement("button");
        wrapper.append(button);

        const enter = press(button, "Enter");
        const space = press(button, " ");

        expect(renderer.onClick).not.toHaveBeenCalled();
        expect(enter.defaultPrevented).toBe(false);
        expect(space.defaultPrevented).toBe(false);
    });
});
