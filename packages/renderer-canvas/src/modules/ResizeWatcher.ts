import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";

/**
 * Observes canvas resizing and keeps viewport/camera in sync.
 * @internal
 */
export class ResizeWatcher {
    private resizeObserver?: ResizeObserver;
    private handleWindowResize?: () => void;
    private currentDpr: number;

    public onResize?: () => void;

    constructor(
        private wrapper: HTMLDivElement,
        private canvas: HTMLCanvasElement,
        private viewport: ViewportState,
        private camera: ICamera,
        private config: Config,
        private onCameraChange: () => void
    ) {
        this.currentDpr = this.viewport.dpr;
    }

    start() {
        // Ensure DPR is up to date before sizing
        this.viewport.updateDpr();
        this.currentDpr = this.viewport.dpr;

        const size = this.viewport.getSize();

        const configSize = this.config.get().size;

        const maxWidth = configSize?.maxWidth;
        const maxHeight = configSize?.maxHeight;

        const minWidth = configSize?.minWidth;
        const minHeight = configSize?.minHeight;

        size.width = this.clamp(size.width, minWidth, maxWidth);
        size.height = this.clamp(size.height, minHeight, maxHeight);

        Object.assign(this.wrapper.style, {
            resize: "both",
            overflow: "hidden",
            width: `${size.width}px`,
            height: `${size.height}px`,
            touchAction: "none",
            position: "relative",
            maxWidth: maxWidth ? `${maxWidth}px` : "",
            maxHeight: maxHeight ? `${maxHeight}px` : "",
            minWidth: minWidth ? `${minWidth}px` : "",
            minHeight: minHeight ? `${minHeight}px` : "",
        });

        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width: rawW, height: rawH } = entry.contentRect;
                const width = this.clamp(rawW, minWidth, maxWidth);
                const height = this.clamp(rawH, minHeight, maxHeight);
                const prev = this.viewport.getSize();

                if (width === prev.width && height === prev.height) {
                    // No effective size change after clamping
                    continue;
                }

                const diffW = width - prev.width;
                const diffH = height - prev.height;
                const dpr = this.viewport.dpr;

                this.camera.adjustForResize(diffW, diffH);
                this.viewport.setSize(width, height);

                // Set canvas resolution (physical pixels for HiDPI)
                this.canvas.width = width * dpr;
                this.canvas.height = height * dpr;

                // Set CSS size (logical pixels)
                this.canvas.style.width = `${width}px`;
                this.canvas.style.height = `${height}px`;

                this.wrapper.style.width = `${width}px`;
                this.wrapper.style.height = `${height}px`;

                if (this.onResize) {
                    this.onResize();
                }
                this.onCameraChange();
            }
        });

        this.resizeObserver.observe(this.wrapper);

        this.attachDprWatcher();
    }

    stop() {
        if (this.resizeObserver) {
            this.resizeObserver.unobserve(this.wrapper);
            this.resizeObserver.disconnect();
        }

        this.resizeObserver = undefined;

        if (this.handleWindowResize) {
            window.removeEventListener("resize", this.handleWindowResize);
            this.handleWindowResize = undefined;
        }
    }

    private clamp(value: number, min?: number, max?: number) {
        let result = value;
        if (min !== undefined) result = Math.max(min, result);
        if (max !== undefined) result = Math.min(max, result);
        return result;
    }

    /**
     * Listen for devicePixelRatio changes (e.g., monitor switch) and rescale canvas.
     */
    private attachDprWatcher() {
        if (typeof window === "undefined") {
            return;
        }

        this.handleWindowResize = () => {
            const prevDpr = this.currentDpr;
            this.viewport.updateDpr();
            const nextDpr = this.viewport.dpr;

            if (nextDpr === prevDpr) {
                return;
            }

            this.currentDpr = nextDpr;
            const { width, height } = this.viewport.getSize();

            // Update canvas resolution for new DPR while keeping logical size
            this.canvas.width = width * nextDpr;
            this.canvas.height = height * nextDpr;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;

            if (this.onResize) {
                this.onResize();
            }

            this.onCameraChange();
        };

        window.addEventListener("resize", this.handleWindowResize, { passive: true });
    }
}
