import { describe, expect, it } from "vitest";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { ICamera } from "../../src/modules/Camera";
import { DEFAULT_VALUES } from "../../src/constants";

const OFFSET = DEFAULT_VALUES.CELL_CENTER_OFFSET;

describe("CoordinateTransformer", () => {
    const createMockCamera = (x: number, y: number, scale: number): ICamera => ({
        x,
        y,
        scale,
        pan: () => {},
        zoom: () => {},
        getCenter: () => ({ x: 0, y: 0 }),
        setCenter: () => {},
        adjustForResize: () => {},
        zoomByFactor: () => {},
        setScale: () => {},
        getVisibleBounds: () => ({ minX: 0, maxX: 100, minY: 0, maxY: 100 }),
    });

    describe("worldToScreen", () => {
        // worldToScreen adds CELL_CENTER_OFFSET to world coords before conversion
        // Formula: (world + OFFSET - cam) * scale

        it("converts world coordinates to screen pixels with cell center offset", () => {
            const camera = createMockCamera(0, 0, 1);
            const transformer = new CoordinateTransformer(camera);
            const screen = transformer.worldToScreen(10, 20);
            // (10 + OFFSET - 0) * 1
            expect(screen.x).toBe(10 + OFFSET);
            expect(screen.y).toBe(20 + OFFSET);
        });

        it("accounts for camera position", () => {
            const camera = createMockCamera(5, 10, 1);
            const transformer = new CoordinateTransformer(camera);
            const screen = transformer.worldToScreen(10, 20);
            // (10 + OFFSET - 5) * 1
            expect(screen.x).toBe(5 + OFFSET);
            expect(screen.y).toBe(10 + OFFSET);
        });

        it("accounts for camera scale", () => {
            const camera = createMockCamera(0, 0, 2);
            const transformer = new CoordinateTransformer(camera);
            const screen = transformer.worldToScreen(10, 20);
            // (10 + OFFSET - 0) * 2
            expect(screen.x).toBe((10 + OFFSET) * 2);
            expect(screen.y).toBe((20 + OFFSET) * 2);
        });

        it("handles combined position and scale", () => {
            const camera = createMockCamera(5, 5, 2);
            const transformer = new CoordinateTransformer(camera);
            const screen = transformer.worldToScreen(10, 10);
            // (10 + OFFSET - 5) * 2
            expect(screen.x).toBe((10 + OFFSET - 5) * 2);
            expect(screen.y).toBe((10 + OFFSET - 5) * 2);
        });

        it("handles negative coordinates", () => {
            const camera = createMockCamera(0, 0, 1);
            const transformer = new CoordinateTransformer(camera);
            const screen = transformer.worldToScreen(-5, -10);
            // (-5 + OFFSET - 0) * 1
            expect(screen.x).toBe(-5 + OFFSET);
            expect(screen.y).toBe(-10 + OFFSET);
        });
    });

    describe("screenToWorld", () => {
        it("converts screen pixels to world coordinates", () => {
            const camera = createMockCamera(0, 0, 1);
            const transformer = new CoordinateTransformer(camera);
            const world = transformer.screenToWorld(100, 200);
            expect(world.x).toBe(100);
            expect(world.y).toBe(200);
        });

        it("accounts for camera position", () => {
            const camera = createMockCamera(10, 20, 1);
            const transformer = new CoordinateTransformer(camera);
            const world = transformer.screenToWorld(100, 200);
            expect(world.x).toBe(110);
            expect(world.y).toBe(220);
        });

        it("accounts for camera scale", () => {
            const camera = createMockCamera(0, 0, 2);
            const transformer = new CoordinateTransformer(camera);
            const world = transformer.screenToWorld(100, 200);
            expect(world.x).toBe(50);
            expect(world.y).toBe(100);
        });

        it("handles combined position and scale", () => {
            const camera = createMockCamera(10, 10, 2);
            const transformer = new CoordinateTransformer(camera);
            const world = transformer.screenToWorld(100, 100);
            // 10 + 100/2 = 60
            expect(world.x).toBe(60);
            expect(world.y).toBe(60);
        });

        it("handles negative screen coordinates", () => {
            const camera = createMockCamera(0, 0, 1);
            const transformer = new CoordinateTransformer(camera);
            const world = transformer.screenToWorld(-50, -100);
            expect(world.x).toBe(-50);
            expect(world.y).toBe(-100);
        });
    });

    describe("round-trip conversion", () => {
        // Note: worldToScreen adds OFFSET, screenToWorld does not subtract it
        // So they are NOT perfect inverses - this is by design for cell-center rendering

        it("worldToScreen then screenToWorld returns world + OFFSET", () => {
            const camera = createMockCamera(15, 25, 1.5);
            const transformer = new CoordinateTransformer(camera);

            const originalWorld = { x: 42, y: 73 };
            const screen = transformer.worldToScreen(originalWorld.x, originalWorld.y);
            const backToWorld = transformer.screenToWorld(screen.x, screen.y);

            // Due to cell center offset, the result is shifted by OFFSET
            expect(backToWorld.x).toBeCloseTo(originalWorld.x + OFFSET);
            expect(backToWorld.y).toBeCloseTo(originalWorld.y + OFFSET);
        });

        it("screenToWorld then worldToScreen returns screen with OFFSET * scale applied", () => {
            const scale = 1.5;
            const camera = createMockCamera(15, 25, scale);
            const transformer = new CoordinateTransformer(camera);

            const originalScreen = { x: 200, y: 300 };
            const world = transformer.screenToWorld(originalScreen.x, originalScreen.y);
            const backToScreen = transformer.worldToScreen(world.x, world.y);

            // worldToScreen adds OFFSET * scale
            expect(backToScreen.x).toBeCloseTo(originalScreen.x + OFFSET * scale);
            expect(backToScreen.y).toBeCloseTo(originalScreen.y + OFFSET * scale);
        });
    });
});
