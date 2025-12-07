import { afterEach, describe, expect, it } from 'vitest';
import { ViewportState } from '../../src/modules/ViewportState';

const originalWindow = globalThis.window;

const setWindow = (value: unknown) => {
  Object.defineProperty(globalThis, 'window', {
    value,
    configurable: true,
    writable: true
  });
};

describe('ViewportState', () => {
  afterEach(() => {
    setWindow(originalWindow);
  });

  it('initializes size and reads device pixel ratio from window', () => {
    setWindow({ devicePixelRatio: 2 });
    const viewport = new ViewportState(300, 200);
    expect(viewport.getSize()).toEqual({ width: 300, height: 200 });
    expect(viewport.dpr).toBe(2);
  });

  it('falls back to DPR 1 when devicePixelRatio is falsy in constructor', () => {
    setWindow({ devicePixelRatio: 0 });
    const viewport = new ViewportState(150, 150);
    expect(viewport.dpr).toBe(1);
  });

  it('updates size via setSize', () => {
    const viewport = new ViewportState(10, 20);
    viewport.setSize(50, 80);
    expect(viewport.getSize()).toEqual({ width: 50, height: 80 });
  });

  it('updateDpr picks up latest devicePixelRatio', () => {
    setWindow({ devicePixelRatio: 1.5 });
    const viewport = new ViewportState(100, 100);
    (globalThis.window as { devicePixelRatio?: number }).devicePixelRatio = 3;
    viewport.updateDpr();
    expect(viewport.dpr).toBe(3);
  });

  it('falls back to DPR 1 when window is missing or falsy', () => {
    setWindow(undefined);
    const viewport = new ViewportState(100, 100);
    expect(viewport.dpr).toBe(1);

    setWindow({ devicePixelRatio: 0 });
    viewport.updateDpr();
    expect(viewport.dpr).toBe(1);
  });

  it('keeps DPR at 1 when window is missing during update', () => {
    setWindow(undefined);
    const viewport = new ViewportState(50, 50);
    viewport.updateDpr();
    expect(viewport.dpr).toBe(1);
  });
});
