/**
 * Holds mutable viewport size for runtime changes (resize, layout).
 * @internal
 */
export class ViewportState {
    private width: number;
    private height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    getSize() {
        return { width: this.width, height: this.height };
    }

    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}
