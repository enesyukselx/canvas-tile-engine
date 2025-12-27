import { ICamera } from "./Camera";
import { Config } from "./Config";
import { IRenderer } from "./Renderer/Renderer";
import { ViewportState } from "./ViewportState";

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

    /** Width limits derived from scale limits (preserve-viewport mode) */
    private widthLimits: { min: number; max: number };

    /** Callback fired after responsive resize */
    public onResize?: () => void;

    constructor(
        private wrapper: HTMLDivElement,
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private renderer: IRenderer,
        private viewport: ViewportState,
        private config: Config,
        private onCameraChange: () => void
    ) {
        this.currentDpr = this.viewport.dpr;

        // Calculate initial visible tiles from config (reference for preserve-viewport)
        const cfg = this.config.get();
        this.initialVisibleTiles = {
            x: cfg.size.width / cfg.scale,
            y: cfg.size.height / cfg.scale,
        };

        // Calculate width limits from scale limits (for preserve-viewport mode)
        this.widthLimits = {
            min: cfg.minScale * this.initialVisibleTiles.x,
            max: cfg.maxScale * this.initialVisibleTiles.x,
        };
    }

    start() {
        const responsiveMode = this.config.get().responsive;
        if (!responsiveMode) {
            return;
        }

        // Ensure DPR is up to date
        this.viewport.updateDpr();
        this.currentDpr = this.viewport.dpr;

        // In preserve-viewport mode, set width to 100% and apply min/max dimensions
        if (responsiveMode === "preserve-viewport") {
            const aspectRatio = this.initialVisibleTiles.y / this.initialVisibleTiles.x;
            this.wrapper.style.width = "100%";
            this.wrapper.style.minWidth = `${this.widthLimits.min}px`;
            this.wrapper.style.maxWidth = `${this.widthLimits.max}px`;
            this.wrapper.style.minHeight = `${this.widthLimits.min * aspectRatio}px`;
            this.wrapper.style.maxHeight = `${this.widthLimits.max * aspectRatio}px`;
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

        if (mode === "preserve-viewport") {
            // Calculate new scale to maintain the same visible tile count
            const newScale = width / this.initialVisibleTiles.x;

            // Calculate height based on configured tile ratio
            const calculatedHeight = Math.round(this.initialVisibleTiles.y * newScale);
            height = calculatedHeight;

            // Apply calculated height to wrapper (width is 100%, max-width handles limits)
            this.wrapper.style.height = `${calculatedHeight}px`;

            // Save current center before changing scale
            const currentCenter = this.camera.getCenter(prev.width, prev.height);

            this.camera.setScale(newScale);

            // Restore center after scale change (must use new dimensions)
            this.camera.setCenter(currentCenter, width, height);
        } else {
            // preserve-scale: adjust camera position to keep center stable
            const diffW = width - prev.width;
            const diffH = height - prev.height;
            this.camera.adjustForResize(diffW, diffH);
        }

        // Update viewport
        this.viewport.setSize(width, height);

        // Update canvas resolution (physical pixels for HiDPI)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Update canvas CSS size (logical pixels)
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // Let renderer know about the resize
        this.renderer.resize(width, height);
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
            this.onCameraChange();
        };

        window.addEventListener("resize", this.handleWindowResize, { passive: true });
    }
}
