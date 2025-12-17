import { beforeEach, describe, expect, it, vi } from "vitest";
import { GestureController } from "../../src/modules/EventManager/GestureController";
import type { ICamera } from "../../src/modules/Camera";
import type { CanvasTileEngineConfig, Coords, onClickCallback, onHoverCallback } from "../../src/types";
import { Config } from "../../src/modules/Config";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { ViewportState } from "../../src/modules/ViewportState";

const baseConfig: CanvasTileEngineConfig = {
    scale: 1,
    size: { width: 100, height: 80 },
    eventHandlers: { click: true, hover: true, drag: true, zoom: true, resize: true },
    cursor: { default: "default", move: "move" },
};

const makeConfig = (overrides: Partial<CanvasTileEngineConfig> = {}) =>
    new Config({ ...baseConfig, ...overrides, size: { ...baseConfig.size, ...(overrides.size ?? {}) } });

const createCamera = () => {
    const pan = vi.fn<(dx: number, dy: number) => void>();
    const zoom = vi.fn<(x: number, y: number, dy: number, rect: DOMRect) => void>();
    const getCenter = vi.fn<(w: number, h: number) => Coords>().mockReturnValue({ x: 0, y: 0 });
    const setCenter = vi.fn<(c: Coords, w: number, h: number) => void>();
    const adjustForResize = vi.fn<(dw: number, dh: number) => void>();
    const zoomByFactor = vi.fn<(factor: number, cx: number, cy: number) => void>();

    const camera: ICamera = {
        x: 0,
        y: 0,
        scale: 1,
        pan: (...args) => pan(...args),
        zoom: (...args) => zoom(...args),
        getCenter: (...args) => getCenter(...args),
        setCenter: (...args) => setCenter(...args),
        adjustForResize: (...args) => adjustForResize(...args),
        zoomByFactor: (...args) => zoomByFactor(...args),
    };

    return { camera, mocks: { pan, zoom, getCenter, setCenter, adjustForResize, zoomByFactor } };
};

const createTransformer = () => {
    const screenToWorld = vi.fn().mockReturnValue({ x: 1, y: 2 });
    const worldToScreen = vi.fn().mockReturnValue({ x: 3, y: 4 });
    const transformer = new CoordinateTransformer({} as unknown as ICamera);
    transformer.screenToWorld = screenToWorld as unknown as typeof transformer.screenToWorld;
    transformer.worldToScreen = worldToScreen as unknown as typeof transformer.worldToScreen;
    return { transformer, screenToWorld, worldToScreen };
};

const createCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () => ({
        left: 10,
        top: 20,
        right: 110,
        bottom: 100,
        width: 100,
        height: 80,
        x: 10,
        y: 20,
        toJSON: () => ({}),
    });
    return canvas;
};

describe("GestureController", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("handles click and hover when enabled", () => {
        const { camera } = createCamera();
        const { transformer, screenToWorld, worldToScreen } = createTransformer();
        const controller = new GestureController(
            createCanvas(),
            camera,
            new ViewportState(100, 80),
            makeConfig(),
            transformer,
            vi.fn()
        );
        const onClick: onClickCallback = vi.fn();
        const onHover: onHoverCallback = vi.fn();
        controller.onClick = onClick;
        controller.onHover = onHover;

        controller.handleClick(new MouseEvent("click", { clientX: 15, clientY: 25 }));
        controller.handleMouseMove(new MouseEvent("mousemove", { clientX: 11, clientY: 22 }));

        expect(screenToWorld).toHaveBeenCalled();
        expect(worldToScreen).toHaveBeenCalled();
        expect(onClick).toHaveBeenCalled();
        expect(onHover).toHaveBeenCalled();
    });

    it("pans on mouse drag and resets cursor on release", () => {
        const { camera, mocks: cameraMocks } = createCamera();
        const { transformer } = createTransformer();
        const onCameraChange = vi.fn();
        const canvas = createCanvas();
        const controller = new GestureController(
            canvas,
            camera,
            new ViewportState(100, 80),
            makeConfig(),
            transformer,
            onCameraChange
        );

        controller.handleMouseDown(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
        controller.handleMouseMove(new MouseEvent("mousemove", { clientX: 15, clientY: 12 }));
        expect(cameraMocks.pan).toHaveBeenCalledWith(5, 2);
        expect(canvas.style.cursor).toBe("move");
        expect(onCameraChange).toHaveBeenCalled();

        controller.handleMouseUp();
        expect(canvas.style.cursor).toBe("default");
    });

    it("performs pinch zoom and pan on touch move", () => {
        const { camera, mocks: cameraMocks } = createCamera();
        const { transformer } = createTransformer();
        const onCameraChange = vi.fn();
        const controller = new GestureController(
            createCanvas(),
            camera,
            new ViewportState(100, 80),
            makeConfig(),
            transformer,
            onCameraChange
        );

        controller.handleTouchStart({
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 10, clientY: 0 },
            ] as unknown as TouchList,
            preventDefault: vi.fn(),
        } as unknown as TouchEvent);

        const preventDefault = vi.fn();
        controller.handleTouchMove({
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 20, clientY: 10 },
            ] as unknown as TouchList,
            preventDefault,
        } as unknown as TouchEvent);

        const [factor, cx, cy] = cameraMocks.zoomByFactor.mock.calls[0];
        expect(factor).toBeCloseTo(2.236, 2);
        expect(cx).toBe(0);
        expect(cy).toBe(-15);
        expect(cameraMocks.pan).toHaveBeenCalledWith(5, 5);
        expect(onCameraChange).toHaveBeenCalled();
        expect(preventDefault).toHaveBeenCalled();
    });

    it("drags with single touch and resets on touch end", () => {
        const { camera, mocks: cameraMocks } = createCamera();
        const { transformer } = createTransformer();
        const canvas = createCanvas();
        const controller = new GestureController(
            canvas,
            camera,
            new ViewportState(100, 80),
            makeConfig(),
            transformer,
            vi.fn()
        );

        controller.handleTouchStart({ touches: [{ clientX: 5, clientY: 5 }] as unknown as TouchList } as unknown as TouchEvent);
        controller.handleTouchMove({
            touches: [{ clientX: 8, clientY: 9 }] as unknown as TouchList,
            preventDefault: vi.fn(),
        } as unknown as TouchEvent);
        expect(cameraMocks.pan).toHaveBeenCalledWith(3, 4);
        expect(canvas.style.cursor).toBe("move");

        controller.handleTouchEnd({ touches: [] as unknown as TouchList } as unknown as TouchEvent);
        expect(canvas.style.cursor).toBe("default");
    });

    it("handles touch end with remaining pinch fingers and with full reset", () => {
        const { camera } = createCamera();
        const { transformer } = createTransformer();
        const controller = new GestureController(
            createCanvas(),
            camera,
            new ViewportState(100, 80),
            makeConfig(),
            transformer,
            vi.fn()
        );

        controller.handleTouchStart({
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 10, clientY: 0 },
            ] as unknown as TouchList,
            preventDefault: vi.fn(),
        } as unknown as TouchEvent);

        controller.handleTouchEnd({
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 20, clientY: 0 },
            ] as unknown as TouchList,
        } as unknown as TouchEvent);
        const state = controller as unknown as { isPinching: boolean; lastPinchDistance: number; lastPinchCenter: { x: number; y: number } };
        expect(state.isPinching).toBe(true);
        expect(state.lastPinchDistance).toBeCloseTo(20);
        expect(state.lastPinchCenter).toEqual({ x: 10, y: 0 });

        controller.handleTouchEnd({ touches: [] as unknown as TouchList } as unknown as TouchEvent);
        const canvasRef = (controller as unknown as { canvas: HTMLCanvasElement }).canvas;
        expect(canvasRef.style.cursor).toBe("default");
    });

    it("handles wheel zoom when enabled and ignores when disabled", () => {
        const { camera, mocks: cameraMocks } = createCamera();
        const { transformer } = createTransformer();
        const onCameraChange = vi.fn();
        const canvas = createCanvas();
        const controller = new GestureController(
            canvas,
            camera,
            new ViewportState(100, 80),
            makeConfig(),
            transformer,
            onCameraChange
        );

        const preventDefault = vi.fn();
        controller.handleWheel({ clientX: 15, clientY: 25, deltaY: 5, preventDefault } as unknown as WheelEvent);
        expect(preventDefault).toHaveBeenCalled();
        expect(cameraMocks.zoom).toHaveBeenCalled();
        expect(onCameraChange).toHaveBeenCalled();

        const disabled = new GestureController(
            canvas,
            camera,
            new ViewportState(100, 80),
            makeConfig({ eventHandlers: { ...baseConfig.eventHandlers, zoom: false } }),
            transformer,
            vi.fn()
        );
        disabled.handleWheel({ clientX: 0, clientY: 0, deltaY: 1, preventDefault: vi.fn() } as unknown as WheelEvent);
        expect(cameraMocks.zoom).toHaveBeenCalledTimes(1);
    });
});
