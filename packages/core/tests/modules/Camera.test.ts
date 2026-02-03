import { describe, expect, it, beforeEach } from "vitest";
import { Camera } from "../../src/modules/Camera";
import { ViewportState } from "../../src/modules/ViewportState";
import { DEFAULT_VALUES } from "../../src/constants";

describe("Camera", () => {
    describe("constructor", () => {
        it("initializes with given coordinates plus cell center offset", () => {
            const camera = new Camera({ x: 10, y: 20 });
            expect(camera.x).toBe(10 + DEFAULT_VALUES.CELL_CENTER_OFFSET);
            expect(camera.y).toBe(20 + DEFAULT_VALUES.CELL_CENTER_OFFSET);
        });

        it("initializes with default scale of 1", () => {
            const camera = new Camera({ x: 0, y: 0 });
            expect(camera.scale).toBe(1);
        });

        it("initializes with custom scale", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2);
            expect(camera.scale).toBe(2);
        });

        it("stores min and max scale limits", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 5);
            expect(camera.minScale).toBe(0.5);
            expect(camera.maxScale).toBe(5);
        });
    });

    describe("setScale", () => {
        it("sets scale within bounds", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 5);
            camera.setScale(3);
            expect(camera.scale).toBe(3);
        });

        it("clamps scale to minimum", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 5);
            camera.setScale(0.1);
            expect(camera.scale).toBe(0.5);
        });

        it("clamps scale to maximum", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 5);
            camera.setScale(10);
            expect(camera.scale).toBe(5);
        });
    });

    describe("pan", () => {
        it("pans inversely to screen deltas scaled by zoom", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2);
            camera.pan(10, -4);
            // pan divides by scale: dx/scale, dy/scale
            expect(camera.x).toBe(DEFAULT_VALUES.CELL_CENTER_OFFSET - 5);
            expect(camera.y).toBe(DEFAULT_VALUES.CELL_CENTER_OFFSET + 2);
        });

        it("accumulates multiple pans", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1);
            camera.pan(10, 10);
            camera.pan(5, 5);
            expect(camera.x).toBe(DEFAULT_VALUES.CELL_CENTER_OFFSET - 15);
            expect(camera.y).toBe(DEFAULT_VALUES.CELL_CENTER_OFFSET - 15);
        });
    });

    describe("zoom", () => {
        it("zooms in when scrolling up (negative deltaY)", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.1, 10);
            const canvasRect = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
            const initialScale = camera.scale;
            camera.zoom(400, 300, -50, canvasRect);
            expect(camera.scale).toBeGreaterThan(initialScale);
        });

        it("zooms out when scrolling down (positive deltaY)", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.1, 10);
            const canvasRect = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
            const initialScale = camera.scale;
            camera.zoom(400, 300, 50, canvasRect);
            expect(camera.scale).toBeLessThan(initialScale);
        });

        it("respects scale limits", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 2);
            const canvasRect = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
            // Try to zoom way out
            for (let i = 0; i < 20; i++) {
                camera.zoom(400, 300, 100, canvasRect);
            }
            expect(camera.scale).toBeGreaterThanOrEqual(0.5);
        });
    });

    describe("zoomByFactor", () => {
        it("zooms in with factor > 1", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.1, 10);
            camera.zoomByFactor(2, 400, 300);
            expect(camera.scale).toBe(2);
        });

        it("zooms out with factor < 1", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2, 0.1, 10);
            camera.zoomByFactor(0.5, 400, 300);
            expect(camera.scale).toBe(1);
        });

        it("respects scale limits", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 2);
            camera.zoomByFactor(10, 400, 300);
            expect(camera.scale).toBe(2);
        });

        it("does nothing when scale would not change", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2, 0.5, 2);
            const initialX = camera.x;
            const initialY = camera.y;
            camera.zoomByFactor(2, 400, 300); // Already at max
            expect(camera.x).toBe(initialX);
            expect(camera.y).toBe(initialY);
        });
    });

    describe("getCenter / setCenter", () => {
        it("returns center of viewport in world coordinates", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1);
            const center = camera.getCenter(800, 600);
            // center = x + width/(2*scale) - OFFSET
            // x starts at OFFSET, so: OFFSET + 400 - OFFSET = 400
            expect(center.x).toBe(400);
            expect(center.y).toBe(300);
        });

        it("setCenter positions camera so given point is centered", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1);
            camera.setCenter({ x: 50, y: 50 }, 800, 600);
            const newCenter = camera.getCenter(800, 600);
            expect(newCenter.x).toBeCloseTo(50);
            expect(newCenter.y).toBeCloseTo(50);
        });

        it("accounts for scale when calculating center", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2);
            const center = camera.getCenter(800, 600);
            // With scale 2: center = x + 800/(2*2) - OFFSET
            // x starts at OFFSET, so: OFFSET + 200 - OFFSET = 200
            expect(center.x).toBe(200);
            expect(center.y).toBe(150);
        });
    });

    describe("adjustForResize", () => {
        it("adjusts position to keep center stable on resize", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1);
            const centerBefore = camera.getCenter(800, 600);
            camera.adjustForResize(100, 50); // Canvas grew by 100x50
            const centerAfter = camera.getCenter(900, 650);
            expect(centerAfter.x).toBeCloseTo(centerBefore.x);
            expect(centerAfter.y).toBeCloseTo(centerBefore.y);
        });

        it("accounts for scale in resize adjustment", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2);
            const centerBefore = camera.getCenter(800, 600);
            camera.adjustForResize(100, 100);
            const centerAfter = camera.getCenter(900, 700);
            expect(centerAfter.x).toBeCloseTo(centerBefore.x);
            expect(centerAfter.y).toBeCloseTo(centerBefore.y);
        });
    });

    describe("getVisibleBounds", () => {
        it("returns floored/ceiled visible world bounds", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1);
            const bounds = camera.getVisibleBounds(800, 600);
            expect(bounds.minX).toBe(0);
            expect(bounds.minY).toBe(0);
            expect(bounds.maxX).toBe(800);
            expect(bounds.maxY).toBe(600);
        });

        it("accounts for camera position", () => {
            const camera = new Camera({ x: 10, y: 20 }, 1);
            const bounds = camera.getVisibleBounds(800, 600);
            expect(bounds.minX).toBe(10);
            expect(bounds.minY).toBe(20);
            expect(bounds.maxX).toBe(810);
            expect(bounds.maxY).toBe(620);
        });

        it("accounts for scale", () => {
            const camera = new Camera({ x: 0, y: 0 }, 2);
            const bounds = camera.getVisibleBounds(800, 600);
            expect(bounds.minX).toBe(0);
            expect(bounds.minY).toBe(0);
            expect(bounds.maxX).toBe(400);
            expect(bounds.maxY).toBe(300);
        });
    });

    describe("setBounds", () => {
        let viewport: ViewportState;

        beforeEach(() => {
            viewport = new ViewportState(800, 600);
        });

        it("limits panning to specified bounds when viewport fits", () => {
            // Use a large bounds area that can contain the viewport
            const camera = new Camera({ x: 50, y: 50 }, 1, 0.1, 10, viewport);
            camera.setBounds({ minX: 0, maxX: 1000, minY: 0, maxY: 1000 });
            // Try to pan outside bounds (pan moves in opposite direction)
            camera.pan(-50000, -50000); // This would move camera position positive
            // Camera x should be clamped so viewport stays in bounds
            // max camera.x = maxX - viewportWidth = 1000 - 800 = 200
            expect(camera.x).toBeLessThanOrEqual(200 + 1);
        });

        it("removes bounds when set to undefined", () => {
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.1, 10, viewport);
            camera.setBounds({ minX: 0, maxX: 1000, minY: 0, maxY: 1000 });
            camera.setBounds(undefined);
            // Now panning should be unrestricted
            camera.pan(-10000, -10000);
            expect(camera.x).toBeGreaterThan(1000);
        });

        it("clamps current position when bounds are set", () => {
            const camera = new Camera({ x: 500, y: 500 }, 1, 0.1, 10, viewport);
            camera.setBounds({ minX: 0, maxX: 1000, minY: 0, maxY: 1000 });
            // Position should be clamped to keep viewport in bounds
            const bounds = camera.getVisibleBounds(800, 600);
            expect(bounds.minX).toBeGreaterThanOrEqual(-1);
            expect(bounds.maxX).toBeLessThanOrEqual(1001);
        });

        it("centers viewport when it is larger than bounds", () => {
            const OFFSET = DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const camera = new Camera({ x: 0, y: 0 }, 1, 0.1, 10, viewport);
            // Viewport is 800x600, bounds are only 100x100
            // When viewport > bounds, camera centers the bounds in viewport
            camera.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
            // Camera x = minX - (viewWidth - boundsWidth) / 2 = 0 - (800 - 100) / 2 = -350
            // Center = x + width/(2*scale) - OFFSET = -350 + 400 - OFFSET = 50 - OFFSET
            const center = camera.getCenter(800, 600);
            expect(center.x).toBeCloseTo(50 - OFFSET, 1);
            expect(center.y).toBeCloseTo(50 - OFFSET, 1);
        });
    });
});
