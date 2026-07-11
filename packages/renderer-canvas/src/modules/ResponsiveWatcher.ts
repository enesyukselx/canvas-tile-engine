import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";

/**
 * Watches wrapper element size changes and handles responsive resizing.
 * Supports two modes:
 * - "preserve-scale": Scale stays constant, visible tile count changes
 * - "preserve-viewport": Visible tile count stays constant, scale changes
 * @internal
 */
export class ResponsiveWatcher {
    private resizeObserver?: ResizeObserver;
    private handleWindowResize?: () => void;
    private currentDpr: number;

    /** Initial visible tiles (used for preserve-viewport mode) */
    private initialVisibleTiles: { x: number; y: number };

    /** Minimum scale limit relative to the base scale (preserve-viewport mode) */
    private minScaleRatio: number;

    /** Callback fired after responsive resize */
    public onResize?: () => void;

    /** Callback fired when a responsive resize changes the camera scale (preserve-viewport) */
    public onScaleChange?: (scale: number) => void;

    constructor(
        private wrapper: HTMLDivElement,
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private onRender: () => void,
    ) {
        this.currentDpr = this.viewport.dpr;

        // Calculate initial visible tiles from config (reference for preserve-viewport)
        const cfg = this.config.get();
        this.initialVisibleTiles = {
            x: cfg.size.width / cfg.scale,
            y: cfg.size.height / cfg.scale,
        };

        // The zoom-out limit is a view intent ("don't zoom out past the base
        // view"), so it is kept as a factor of the base scale. The zoom-in
        // limit is a px-per-tile quality cap and stays absolute.
        this.minScaleRatio = cfg.minScale / cfg.scale;
    }

    start() {
        const responsiveMode = this.config.get().responsive;
        if (!responsiveMode) {
            return;
        }

        // Ensure DPR is up to date
        this.viewport.updateDpr();
        this.currentDpr = this.viewport.dpr;

        // Set wrapper dimensions based on responsive mode
        if (responsiveMode === "preserve-viewport") {
            // Width follows the container; scale limits adapt in applySize,
            // so no CSS min/max width is needed to protect them
            this.wrapper.style.width = "100%";
        } else {
            // preserve-scale: width is responsive, height stays at initial config value
            const cfg = this.config.get();
            this.wrapper.style.width = "100%";
            this.wrapper.style.height = `${cfg.size.height}px`;
        }

        // Get initial size from wrapper (user controls via CSS)
        const wrapperRect = this.wrapper.getBoundingClientRect();
        const initialWidth = Math.round(wrapperRect.width);
        const initialHeight = Math.round(wrapperRect.height);

        // Apply initial size
        this.applySize(initialWidth, initialHeight, responsiveMode);

        // Setup ResizeObserver to watch wrapper
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width: rawW, height: rawH } = entry.contentRect;
                const width = Math.round(rawW);
                const height = Math.round(rawH);

                if (width <= 0 || height <= 0) {
                    continue;
                }

                const prev = this.viewport.getSize();
                if (width === prev.width && height === prev.height) {
                    continue;
                }

                this.applySize(width, height, responsiveMode);

                this.onResize?.();
                this.onRender();
            }
        });

        this.resizeObserver.observe(this.wrapper);
        this.attachDprWatcher();
    }

    stop() {
        if (this.resizeObserver) {
            this.resizeObserver.unobserve(this.wrapper);
            this.resizeObserver.disconnect();
            this.resizeObserver = undefined;
        }

        if (this.handleWindowResize) {
            window.removeEventListener("resize", this.handleWindowResize);
            this.handleWindowResize = undefined;
        }
    }

    private applySize(width: number, height: number, mode: "preserve-scale" | "preserve-viewport") {
        const dpr = this.viewport.dpr;
        const prev = this.viewport.getSize();
        const prevScale = this.camera.scale;

        if (mode === "preserve-viewport") {
            // Calculate new scale to maintain the same visible tile count
            const newScale = width / this.initialVisibleTiles.x;

            // Calculate height based on configured tile ratio
            const calculatedHeight = Math.round(this.initialVisibleTiles.y * newScale);
            height = calculatedHeight;

            // Apply calculated height to wrapper (width is 100%)
            this.wrapper.style.height = `${calculatedHeight}px`;

            // Save current center before changing scale
            const currentCenter = this.camera.getCenter(prev.width, prev.height);

            // Update viewport before mutating the camera so bounds clamping
            // uses the new dimensions
            this.viewport.setSize(width, height);

            // Rescale the zoom-out limit with the base scale so it keeps its
            // meaning at every container width; keep the zoom-in limit at its
            // configured px value, only lifting it when the base scale itself
            // exceeds it, so the camera never lands outside gesture-reachable
            // limits
            const maxScale = Math.max(this.config.get().maxScale, newScale);
            this.camera.setScaleLimits(newScale * this.minScaleRatio, maxScale);
            this.camera.setScale(newScale);

            // Restore center after scale change (must use new dimensions)
            this.camera.setCenter(currentCenter, width, height);
        } else {
            this.viewport.setSize(width, height);

            // preserve-scale: adjust camera position to keep center stable
            const diffW = width - prev.width;
            const diffH = height - prev.height;
            this.camera.adjustForResize(diffW, diffH);

            this.adaptMinScaleToBounds(width, height);
        }

        // Update canvas resolution (physical pixels for HiDPI)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Update canvas CSS size (logical pixels)
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        if (this.camera.scale !== prevScale) {
            this.onScaleChange?.(this.camera.scale);
        }
    }

    /**
     * preserve-scale: rescale the minimum zoom limit with the scale at which
     * the bounded area fits the viewport, so intents like "minScale shows the
     * whole board" survive container resizes. No-op without finite bounds.
     */
    private adaptMinScaleToBounds(width: number, height: number) {
        const cfg = this.config.get();
        const boundsWidth = cfg.bounds.maxX - cfg.bounds.minX;
        const boundsHeight = cfg.bounds.maxY - cfg.bounds.minY;

        const fitScale = (w: number, h: number) => {
            let fit = Infinity;
            if (Number.isFinite(boundsWidth)) {
                fit = Math.min(fit, w / boundsWidth);
            }
            if (Number.isFinite(boundsHeight)) {
                fit = Math.min(fit, h / boundsHeight);
            }
            return fit;
        };

        const initialFit = fitScale(cfg.size.width, cfg.size.height);
        if (!Number.isFinite(initialFit)) {
            return;
        }

        let minScale = cfg.minScale * (fitScale(width, height) / initialFit);
        // Never tighten past the zoom-in limit or the current scale — the
        // camera must always stay inside its own limits
        minScale = Math.min(minScale, cfg.maxScale, this.camera.scale);
        this.camera.setScaleLimits(minScale, cfg.maxScale);
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

            this.onResize?.();
            this.onRender();
        };

        window.addEventListener("resize", this.handleWindowResize, { passive: true });
    }
}
