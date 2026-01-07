/**
 * Holds mutable viewport size for runtime changes (resize, layout).
 * Also tracks device pixel ratio for HiDPI/Retina display support.
 */
export class ViewportState {
    private width: number;
    private height: number;
    private _dpr: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this._dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    }

    getSize() {
        return { width: this.width, height: this.height };
    }

    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    /**
     * Get the current device pixel ratio.
     * Used for HiDPI/Retina display rendering.
     */
    get dpr(): number {
        return this._dpr;
    }

    /**
     * Update DPR (useful when window moves between displays).
     */
    updateDpr() {
        this._dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    }
}
