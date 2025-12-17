import { describe, expect, it } from 'vitest';
import { Camera } from '../../src/modules/Camera';
import { ViewportState } from '../../src/modules/ViewportState';

const makeRect = (left: number, top: number): DOMRect =>
  ({ left, top } as DOMRect);

describe('Camera', () => {
  it('initializes with cell-center offset and computes center positions', () => {
    const camera = new Camera({ x: 0, y: 0 }, 2);
    expect(camera.x).toBe(0.5);
    expect(camera.y).toBe(0.5);

    const center = camera.getCenter(200, 100);
    expect(center).toEqual({ x: 50, y: 25 });

    camera.setCenter({ x: 10, y: 20 }, 200, 100);
    expect(camera.x).toBeCloseTo(-39.5);
    expect(camera.y).toBeCloseTo(-4.5);
  });

  it('pans according to screen delta and clamps to bounds', () => {
    const viewport = new ViewportState(100, 100);
    const camera = new Camera({ x: 0, y: 0 }, 2, 0.1, 10, viewport);
    camera.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });

    camera.pan(-120, 0); // move right substantially
    expect(camera.x).toBeCloseTo(50); // clamped to max - viewWidth (100/2)

    camera.pan(0, 120); // move up substantially (screen y down)
    expect(camera.y).toBeCloseTo(0); // clamped to min
  });

  it('recenters when viewport is larger than bounds', () => {
    const viewport = new ViewportState(100, 100);
    const camera = new Camera({ x: 0, y: 0 }, 1, 0.1, 10, viewport);
    camera.setBounds({ minX: 0, maxX: 50, minY: 0, maxY: 50 });

    expect(camera.x).toBeCloseTo(-25);
    expect(camera.y).toBeCloseTo(-25);
  });

  it('zooms around mouse position using DOMRect-relative coords', () => {
    const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 2);
    const rect = makeRect(100, 200);
    camera.zoom(110, 215, -50, rect); // mouse is (10,15) relative to rect, zoom in

    const expectedScale = Math.min(
      2,
      Math.max(
        0.5,
        1 * Math.exp(-Math.max(-50, -100) * 0.001) // delta clamped by defaults in computeZoom
      )
    );
    expect(camera.scale).toBeCloseTo(expectedScale);
    // Top-left should shift opposite to mouse to keep focus
    const expectedX = 0.5 + 10 * (1 / 1 - 1 / expectedScale);
    const expectedY = 0.5 + 15 * (1 / 1 - 1 / expectedScale);
    expect(camera.x).toBeCloseTo(expectedX);
    expect(camera.y).toBeCloseTo(expectedY);
  });

  it('zoomByFactor clamps scale and repositions around center point', () => {
    const viewport = new ViewportState(100, 100);
    const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 2, viewport);
    camera.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });

    camera.zoomByFactor(10, 50, 50); // would exceed max scale
    expect(camera.scale).toBe(2);
    expect(camera.x).toBeCloseTo(25);
    expect(camera.y).toBeCloseTo(25);

    camera.zoomByFactor(0.01, 50, 50); // would drop below min -> clamp, no movement
    expect(camera.scale).toBe(0.5);
  });

  it('zoomByFactor no-ops when factor keeps scale unchanged', () => {
    const camera = new Camera({ x: 10, y: 20 }, 1, 0.5, 2);
    const { x: beforeX, y: beforeY, scale: beforeScale } = {
      x: camera.x,
      y: camera.y,
      scale: camera.scale
    };
    camera.zoomByFactor(1, 30, 30);
    expect(camera.scale).toBe(beforeScale);
    expect(camera.x).toBe(beforeX);
    expect(camera.y).toBe(beforeY);
  });

  it('removes bounds and skips clamping when unset', () => {
    const viewport = new ViewportState(100, 100);
    const camera = new Camera({ x: 0, y: 0 }, 1, 0.5, 2, viewport);
    camera.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
    camera.setBounds(undefined); // clears bounds, clampToBounds early-return path

    camera.pan(200, 0); // move left in world
    expect(camera.x).toBeCloseTo(-200);
  });

  it('adjusts for resize keeping center stable', () => {
    const camera = new Camera({ x: 0, y: 0 }, 2);
    camera.adjustForResize(20, -10);
    // x moves left by half delta / scale, y moves down because height decreased
    expect(camera.x).toBeCloseTo(-4.5); // 0.5 - 20/(2*2) = 0.5 - 5 = -4.5
    expect(camera.y).toBeCloseTo(3); // 0.5 - (-10)/(2*2) = 0.5 + 2.5 = 3
  });
});
