import { describe, expect, it, vi } from "vitest";
import { AnimationController, Config, Coords, ICamera, ViewportState } from "@canvas-tile-engine/core";
import { SizeController } from "../src/dom/SizeController";

function createFakeCanvas() {
    return { width: 0, height: 0, style: {} as Record<string, string> } as unknown as HTMLCanvasElement;
}

function createController(options?: {
    canvasCount?: number;
    size?: {
        width: number;
        height: number;
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
    };
}) {
    const size = options?.size ?? { width: 1000, height: 800 };
    const config = new Config({ scale: 10, minScale: 1, maxScale: 40, size });
    const viewport = new ViewportState(size.width, size.height);
    const wrapper = { style: {} as Record<string, string> } as unknown as HTMLDivElement;
    const canvases = Array.from({ length: options?.canvasCount ?? 1 }, createFakeCanvas);
    const camera = { setCenter: vi.fn() } as unknown as ICamera & { setCenter: ReturnType<typeof vi.fn> };
    const onRender = vi.fn();
    const controller = new SizeController(wrapper, canvases, camera, viewport, config, onRender);
    return { controller, wrapper, canvases, camera, viewport, onRender };
}

describe("SizeController", () => {
    describe("applySize", () => {
        it("applies rounded size to wrapper, every canvas, viewport, and camera, then renders", () => {
            const { controller, wrapper, canvases, camera, viewport, onRender } = createController({ canvasCount: 2 });
            const center: Coords = { x: 5, y: 7 };

            controller.applySize(640.4, 480.6, center);

            expect(viewport.getSize()).toEqual({ width: 640, height: 481 });
            expect(wrapper.style.width).toBe("640px");
            expect(wrapper.style.height).toBe("481px");
            for (const canvas of canvases) {
                // dpr is 1 in the node environment
                expect(canvas.width).toBe(640);
                expect(canvas.height).toBe(481);
                expect(canvas.style.width).toBe("640px");
                expect(canvas.style.height).toBe("481px");
            }
            expect(camera.setCenter).toHaveBeenCalledWith(center, 640, 481);
            expect(onRender).toHaveBeenCalledTimes(1);
        });

        it("scales canvas resolution by the device pixel ratio while CSS size stays logical", () => {
            vi.stubGlobal("window", { devicePixelRatio: 2 });
            try {
                const { controller, canvases } = createController();

                controller.applySize(100, 50, { x: 0, y: 0 });

                expect(canvases[0]!.width).toBe(200);
                expect(canvases[0]!.height).toBe(100);
                expect(canvases[0]!.style.width).toBe("100px");
                expect(canvases[0]!.style.height).toBe("50px");
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });

    describe("resizeWithAnimation", () => {
        it("ignores non-positive target sizes", () => {
            const { controller } = createController();
            const animateResize = vi.fn();
            const animation = { animateResize } as unknown as AnimationController;

            controller.resizeWithAnimation(0, 100, 500, animation);
            controller.resizeWithAnimation(100, -1, 500, animation);

            expect(animateResize).not.toHaveBeenCalled();
        });

        it("clamps the target size into the configured min/max range", () => {
            const { controller } = createController({
                size: { width: 1000, height: 800, minWidth: 300, maxWidth: 1200, minHeight: 200, maxHeight: 900 },
            });
            const animateResize = vi.fn();
            const animation = { animateResize } as unknown as AnimationController;

            controller.resizeWithAnimation(100, 5000, 500, animation);

            expect(animateResize).toHaveBeenCalledWith(300, 900, 500, expect.any(Function), undefined);
        });

        it("delegates each animation step to applySize", () => {
            const { controller, viewport, onRender } = createController();
            const animateResize = vi.fn();
            const animation = { animateResize } as unknown as AnimationController;
            const onComplete = () => {};

            controller.resizeWithAnimation(640, 480, 500, animation, onComplete);

            expect(animateResize).toHaveBeenCalledWith(640, 480, 500, expect.any(Function), onComplete);
            const step = animateResize.mock.calls[0]![3] as (w: number, h: number, center: Coords) => void;
            step(640, 480, { x: 1, y: 2 });
            expect(viewport.getSize()).toEqual({ width: 640, height: 480 });
            expect(onRender).toHaveBeenCalledTimes(1);
        });
    });
});
