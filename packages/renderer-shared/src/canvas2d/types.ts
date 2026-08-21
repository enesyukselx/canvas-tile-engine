import type { CommandTraceTarget, TextAlign, TextBaseline } from "@canvas-tile-engine/core";

/**
 * Anything with pixel dimensions the pipeline can measure and blit: images
 * (HTMLImageElement, @napi-rs/canvas Image) and offscreen cache canvases.
 */
export interface CanvasImageSourceLike {
    readonly width: number;
    readonly height: number;
}

/**
 * The gradient object `createLinearGradient` hands back. Both the browser's
 * `CanvasGradient` and @napi-rs/canvas's own are exactly this one method.
 */
export interface CanvasGradientLike {
    addColorStop(offset: number, color: string): void;
}

/**
 * Minimal structural view of a Canvas2D-style rendering context — only the
 * members the shared pipeline actually calls. Browser contexts
 * (CanvasRenderingContext2D, OffscreenCanvasRenderingContext2D) and
 * @napi-rs/canvas SKRSContext2D all satisfy it. Style properties are
 * declared with divergent accessors: the pipeline only ever writes plain
 * values, while each host context reads back its own richer union.
 *
 * Do not add members speculatively; a member enters this interface the day
 * shared code calls it.
 */
export interface Canvas2DContextLike<TDrawable = never> extends CommandTraceTarget {
    save(): void;
    restore(): void;
    beginPath(): void;
    rect(x: number, y: number, w: number, h: number): void;
    /** Optional: callers guard, falling back to `rect` (older environments). */
    roundRect?(x: number, y: number, w: number, h: number, radii?: number | number[]): void;
    fill(fillRule?: "nonzero" | "evenodd"): void;
    stroke(): void;
    setLineDash(segments: number[]): void;
    translate(x: number, y: number): void;
    rotate(angle: number): void;
    scale(x: number, y: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike;
    drawImage(image: TDrawable, dx: number, dy: number, dw: number, dh: number): void;
    drawImage(
        image: TDrawable,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number,
    ): void;
    lineWidth: number;
    globalAlpha: number;
    font: string;
    get fillStyle(): unknown;
    set fillStyle(value: string | CanvasGradientLike);
    get strokeStyle(): unknown;
    set strokeStyle(value: string);
    get textAlign(): unknown;
    set textAlign(value: TextAlign);
    get textBaseline(): unknown;
    set textBaseline(value: TextBaseline);
}

/**
 * Creates a fresh offscreen canvas plus context for static caching, or null
 * when the environment cannot provide one (the pipeline then falls back to
 * dynamic drawing). Renderers pass `null` for the factory itself when the
 * platform has no offscreen surface at all.
 */
export type OffscreenCanvasFactory<TContext, TCanvas> = (
    width: number,
    height: number,
) => { canvas: TCanvas; ctx: TContext } | null;
