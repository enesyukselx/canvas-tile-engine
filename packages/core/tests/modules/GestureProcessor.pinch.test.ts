import { describe, expect, it, vi } from "vitest";
import { Camera } from "../../src/modules/Camera";
import { Config } from "../../src/modules/Config";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { GestureProcessor, type NormalizedPointer } from "../../src/modules/GestureProcessor";
import { ViewportState } from "../../src/modules/ViewportState";
import type { Bounds, Coords, EventHandlers } from "../../src/types";

// Exercise the actual camera and coordinate transforms: mocking pan/zoom hid
// the moving-midpoint error even when both methods received plausible inputs.
function createRig({
    scale = 1,
    minScale = 0.1,
    maxScale = 10,
    zoom = "pointer",
    size = { width: 800, height: 600 },
    topLeft = { x: 0, y: 0 },
    bounds,
}: {
    scale?: number;
    minScale?: number;
    maxScale?: number;
    zoom?: EventHandlers["zoom"];
    size?: { width: number; height: number };
    topLeft?: Coords;
    bounds?: Bounds;
} = {}) {
    const camera = new Camera(topLeft, scale, minScale, maxScale, new ViewportState(size.width, size.height));
    camera.setBounds(bounds);
    const transformer = new CoordinateTransformer(camera);
    const config = new Config({ scale, minScale, maxScale, size, eventHandlers: { zoom, drag: true } });
    const left = 120;
    const top = 80;
    const canvasBounds = {
        ...size,
        left,
        top,
        x: left,
        y: top,
        right: left + size.width,
        bottom: top + size.height,
    };
    const onCameraChange = vi.fn();
    const onZoom = vi.fn();
    const onWheel = vi.fn();
    const processor = new GestureProcessor(camera, config, transformer, () => canvasBounds, onCameraChange);
    processor.onZoom = onZoom;
    processor.onWheel = onWheel;
    const pointer = (x: number, y: number): NormalizedPointer => ({ x, y, clientX: x + left, clientY: y + top });
    const pair = (x: number, y: number, distance: number) => [
        pointer(x - distance / 2, y),
        pointer(x + distance / 2, y),
    ];

    return { camera, transformer, processor, pointer, pair, onCameraChange, onZoom, onWheel };
}

function expectAnchor(transformer: CoordinateTransformer, screen: Coords, world: Coords) {
    const actual = transformer.screenToWorld(screen.x, screen.y);
    expect(actual.x).toBeCloseTo(world.x, 10);
    expect(actual.y).toBeCloseTo(world.y, 10);
    // screenToWorld is corner-space; worldToScreen expects cell-center space.
    const projected = transformer.worldToScreen(world.x - 0.5, world.y - 0.5);
    expect(projected.x).toBeCloseTo(screen.x, 10);
    expect(projected.y).toBeCloseTo(screen.y, 10);
}

describe("pinch camera geometry", () => {
    it.each([true, "pointer"] as const)("preserves the audit's moving midpoint with zoom=%s", (zoom) => {
        const { camera, transformer, processor, pair, onCameraChange, onZoom, onWheel } = createRig({ zoom });
        const world = transformer.screenToWorld(100, 100);
        expect(world).toEqual({ x: 100.5, y: 100.5 });

        processor.handleTouchStart(pair(100, 100, 100)); // fingers x=50/150
        processor.handleTouchMove(pair(150, 100, 200)); // fingers x=50/250

        expect(camera.scale).toBe(2);
        expect(camera.x).toBe(25.5);
        expectAnchor(transformer, { x: 150, y: 100 }, world);
        expect(onCameraChange).toHaveBeenCalledTimes(1);
        expect(onZoom).toHaveBeenCalledExactlyOnceWith(2);
        expect(onWheel).toHaveBeenCalledTimes(1);
        // Callbacks observe the completed transform, including the translation.
        expect(onWheel.mock.calls[0][0].raw).toEqual(world);
        expect(onWheel.mock.calls[0][1].raw).toEqual({ x: 150, y: 100 });
        expect(onWheel.mock.calls[0][2].raw).toEqual({ x: 270, y: 180 });
        expect(onWheel.mock.calls[0][3]).toMatchObject({ source: "pinch", direction: "in" });
    });

    it("keeps a fixed midpoint stationary during symmetric zoom", () => {
        const { camera, transformer, processor, pair } = createRig();
        const world = transformer.screenToWorld(300, 200);
        processor.handleTouchStart(pair(300, 200, 100));
        processor.handleTouchMove(pair(300, 200, 250));

        expect(camera.scale).toBe(2.5);
        expectAnchor(transformer, { x: 300, y: 200 }, world);
    });

    it("translates both axes when distance stays constant without emitting zoom callbacks", () => {
        const { camera, transformer, processor, pair, onZoom, onWheel } = createRig({ scale: 2 });
        const world = transformer.screenToWorld(100, 150);
        processor.handleTouchStart(pair(100, 150, 100));
        processor.handleTouchMove(pair(160, 110, 100));

        expect(camera.scale).toBe(2);
        expectAnchor(transformer, { x: 160, y: 110 }, world);
        expect(onZoom).not.toHaveBeenCalled();
        expect(onWheel).not.toHaveBeenCalled();
    });

    it("preserves the anchor through repeated two-axis pinches and a return to the starting gesture", () => {
        const { camera, transformer, processor, pointer } = createRig({ topLeft: { x: -40, y: 75 } });
        const steps = [
            [50, 50, 150, 150],
            [30, 90, 230, 210],
            [70, 30, 170, 80],
            [-20, 100, 300, 240],
            [50, 50, 150, 150],
        ];
        const world = transformer.screenToWorld(100, 100);
        processor.handleTouchStart([pointer(50, 50), pointer(150, 150)]);
        for (const [x1, y1, x2, y2] of steps.slice(1)) {
            processor.handleTouchMove([pointer(x1, y1), pointer(x2, y2)]);
            expectAnchor(transformer, { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, world);
        }

        expect(camera.scale).toBeCloseTo(1, 10);
        expect(camera.x).toBeCloseTo(-39.5, 10);
        expect(camera.y).toBeCloseTo(75.5, 10);
    });

    it.each([
        { label: "maximum", distance: 300, expectedScale: 2, furtherDistance: 400 },
        { label: "minimum", distance: 10, expectedScale: 0.5, furtherDistance: 5 },
    ])(
        "uses the effective scale and continues translating at the $label limit",
        ({ distance, expectedScale, furtherDistance }) => {
            const { camera, transformer, processor, pair, onZoom, onWheel } = createRig({ minScale: 0.5, maxScale: 2 });
            const world = transformer.screenToWorld(100, 100);
            processor.handleTouchStart(pair(100, 100, 100));
            processor.handleTouchMove(pair(150, 120, distance));

            expect(camera.scale).toBe(expectedScale);
            expectAnchor(transformer, { x: 150, y: 120 }, world);
            processor.handleTouchMove(pair(180, 90, furtherDistance));
            expect(camera.scale).toBe(expectedScale);
            expectAnchor(transformer, { x: 180, y: 90 }, world);
            expect(onZoom).toHaveBeenCalledExactlyOnceWith(expectedScale);
            expect(onWheel).toHaveBeenCalledTimes(2);
        },
    );

    it.each([
        { label: "minimum", start: 75, end: 25, topLeft: 0, expected: 13 },
        { label: "maximum", start: 25, end: 75, topLeft: 149.5, expected: 87.5 },
    ])("does not clamp an intermediate zoom at the $label camera bound", ({ start, end, topLeft, expected }) => {
        const { camera, transformer, processor, pair } = createRig({
            scale: 2,
            size: { width: 100, height: 100 },
            topLeft: { x: topLeft, y: topLeft },
            bounds: { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        });
        const world = transformer.screenToWorld(start, start);
        processor.handleTouchStart(pair(start, start, 100));
        processor.handleTouchMove(pair(end, end, 50));

        expect(camera.scale).toBe(1);
        expect(camera.x).toBe(expected);
        expect(camera.y).toBe(expected);
        expectAnchor(transformer, { x: end, y: end }, world);
    });

    it("constrains the final transform and responds immediately when moving away from a bound", () => {
        const { camera, transformer, processor, pair } = createRig({
            size: { width: 100, height: 100 },
            bounds: { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        });
        processor.handleTouchStart(pair(50, 50, 40));
        processor.handleTouchMove(pair(200, 200, 80));
        expect(camera.scale).toBe(2);
        expect(camera.x).toBe(0);
        expect(camera.y).toBe(0);

        const worldAtBound = transformer.screenToWorld(200, 200);
        processor.handleTouchMove(pair(190, 190, 80));
        expect(camera.x).toBe(5);
        expect(camera.y).toBe(5);
        expectAnchor(transformer, { x: 190, y: 190 }, worldAtBound);
    });

    it("centers bounds when the final viewport is larger than the bounded area", () => {
        const { camera, processor, pair } = createRig({
            scale: 2,
            size: { width: 100, height: 100 },
            bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
        });
        processor.handleTouchStart(pair(50, 50, 80));
        processor.handleTouchMove(pair(75, 25, 20));

        expect(camera.scale).toBe(0.5);
        expect(camera.x).toBe(-50);
        expect(camera.y).toBe(-50);
    });

    it("preserves center mode's fixed viewport anchor despite midpoint motion and scale limits", () => {
        const { camera, transformer, processor, pair, onZoom } = createRig({ zoom: "center", maxScale: 2 });
        const world = transformer.screenToWorld(400, 300);
        processor.handleTouchStart(pair(100, 100, 100));
        processor.handleTouchMove(pair(150, 120, 200));
        expectAnchor(transformer, { x: 400, y: 300 }, world);
        const position = { x: camera.x, y: camera.y };

        processor.handleTouchMove(pair(190, 180, 200));
        processor.handleTouchMove(pair(220, 200, 400));
        expect(camera.scale).toBe(2);
        expect({ x: camera.x, y: camera.y }).toEqual(position);
        expectAnchor(transformer, { x: 400, y: 300 }, world);
        expect(onZoom).toHaveBeenCalledExactlyOnceWith(2);
    });

    it("translates a degenerate pinch safely and resumes zoom from the next valid distance", () => {
        const { camera, transformer, processor, pair } = createRig();
        const world = transformer.screenToWorld(100, 100);
        processor.handleTouchStart(pair(100, 100, 0));
        processor.handleTouchMove(pair(150, 120, 40));
        expect(camera.scale).toBe(1);
        expectAnchor(transformer, { x: 150, y: 120 }, world);

        processor.handleTouchMove(pair(180, 140, 80));
        expect(camera.scale).toBe(2);
        expectAnchor(transformer, { x: 180, y: 140 }, world);
    });
});
