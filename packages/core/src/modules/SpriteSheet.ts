import type { SpriteRect } from "../types/draw-object";

export interface SpriteSheetOptions {
    /** Width of a single frame in sheet pixels. */
    frameWidth: number;
    /** Height of a single frame in sheet pixels. */
    frameHeight: number;
    /** Number of columns in the sheet. Required for index-based lookups. */
    columns?: number;
    /** Outer offset from the sheet edges in pixels (default: 0). */
    margin?: number;
    /** Gap between adjacent frames in pixels (default: 0). */
    spacing?: number;
}

/**
 * Grid-based spritesheet frame calculator. Maps (col, row) or linear frame
 * indices to pixel source rectangles ({@link SpriteRect}) inside a sheet image.
 *
 * Pure calculation — holds no image reference, so it is platform-agnostic and
 * works with every renderer.
 *
 * @example
 * ```ts
 * const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 5 });
 * engine.drawImage({ x: 5, y: 3, img, sprite: sheet.frame(3, 0) });
 * ```
 */
export class SpriteSheet {
    private readonly frameWidth: number;
    private readonly frameHeight: number;
    private readonly columns?: number;
    private readonly margin: number;
    private readonly spacing: number;

    constructor(options: SpriteSheetOptions) {
        if (options.frameWidth <= 0 || options.frameHeight <= 0) {
            throw new Error("SpriteSheet: frameWidth and frameHeight must be positive");
        }
        if (options.columns !== undefined && (options.columns <= 0 || !Number.isInteger(options.columns))) {
            throw new Error("SpriteSheet: columns must be a positive integer");
        }
        this.frameWidth = options.frameWidth;
        this.frameHeight = options.frameHeight;
        this.columns = options.columns;
        this.margin = options.margin ?? 0;
        this.spacing = options.spacing ?? 0;
    }

    /**
     * Source rectangle of the frame at grid position (col, row).
     */
    frame(col: number, row: number): SpriteRect {
        if (col < 0 || row < 0) {
            throw new Error(`SpriteSheet: frame position must be non-negative, got (${col}, ${row})`);
        }
        return {
            x: this.margin + col * (this.frameWidth + this.spacing),
            y: this.margin + row * (this.frameHeight + this.spacing),
            w: this.frameWidth,
            h: this.frameHeight,
        };
    }

    /**
     * Source rectangle of a frame by linear index (left-to-right, top-to-bottom).
     * Requires `columns` to be set.
     */
    frameByIndex(index: number): SpriteRect {
        if (this.columns === undefined) {
            throw new Error("SpriteSheet: frameByIndex requires the `columns` option");
        }
        if (index < 0) {
            throw new Error(`SpriteSheet: frame index must be non-negative, got ${index}`);
        }
        return this.frame(index % this.columns, Math.floor(index / this.columns));
    }

    /**
     * Consecutive frames of a single row, from `startCol` to `endCol` inclusive.
     * Useful as an animation frame list, e.g. `framesInRow(0, 0, 4)` for the
     * frames (0,0) through (4,0).
     */
    framesInRow(row: number, startCol: number, endCol: number): SpriteRect[] {
        if (endCol < startCol) {
            throw new Error(`SpriteSheet: endCol (${endCol}) must be >= startCol (${startCol})`);
        }
        const frames: SpriteRect[] = [];
        for (let col = startCol; col <= endCol; col++) {
            frames.push(this.frame(col, row));
        }
        return frames;
    }
}
