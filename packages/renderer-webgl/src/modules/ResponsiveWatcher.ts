import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";

/**
 * Watches wrapper element size changes and handles responsive resizing.
 * Resizes both the WebGL canvas and the 2D overlay canvas.
 * @internal
 */
export class ResponsiveWatcher {
    private resizeObserver?: ResizeObserver;
    private handleWindowResize?: () => void;
    private currentDpr: number;

    private initialVisibleTiles: { x: number; y: number };

    /** Scale limits relative to the base scale (preserve-viewport mode) */
    private scaleLimitRatios: { min: number; max: number };

    public onResize?: () => void;

    constructor(
        private wrapper: HTMLDivElement,
        private canvas: HTMLCanvasElement,
        private overlay: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private onRender: () => void,
    ) {
        this.currentDpr = this.viewport.dpr;

        const cfg = this.config.get();
        this.initialVisibleTiles = {
            x: cfg.size.width / cfg.scale,
            y: cfg.size.height / cfg.scale,
        };

        // Configured scale limits expressed as zoom factors of the base scale,
        // so they keep their meaning when preserve-viewport rescales the base
        this.scaleLimitRatios = {
            min: cfg.minScale / cfg.scale,
            max: cfg.maxScale / cfg.scale,
        };
    }

    start() {
        const responsiveMode = this.config.get().responsive;
        if (!responsiveMode) {
            return;
        }

        this.viewport.updateDpr();
        this.currentDpr = this.viewport.dpr;

        if (responsiveMode === "preserve-viewport") {
            // Width follows the container; scale limits adapt in applySize,
            // so no CSS min/max width is needed to protect them
            this.wrapper.style.width = "100%";
        } else {
            const cfg = this.config.get();
            this.wrapper.style.width = "100%";
            this.wrapper.style.height = `${cfg.size.height}px`;
        }

        const wrapperRect = this.wrapper.getBoundingClientRect();
        const initialWidth = Math.round(wrapperRect.width);
        const initialHeight = Math.round(wrapperRect.height);

        this.applySize(initialWidth, initialHeight, responsiveMode);

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

        if (mode === "preserve-viewport") {
            const newScale = width / this.initialVisibleTiles.x;
            const calculatedHeight = Math.round(this.initialVisibleTiles.y * newScale);
            height = calculatedHeight;

            this.wrapper.style.height = `${calculatedHeight}px`;

            const currentCenter = this.camera.getCenter(prev.width, prev.height);

            // Update viewport before mutating the camera so bounds clamping
            // uses the new dimensions
            this.viewport.setSize(width, height);

            // Rescale the zoom limits with the base scale so the configured
            // range keeps acting as zoom factors and the camera never lands
            // outside gesture-reachable limits
            this.camera.setScaleLimits(newScale * this.scaleLimitRatios.min, newScale * this.scaleLimitRatios.max);
            this.camera.setScale(newScale);

            this.camera.setCenter(currentCenter, width, height);
        } else {
            this.viewport.setSize(width, height);

            const diffW = width - prev.width;
            const diffH = height - prev.height;
            this.camera.adjustForResize(diffW, diffH);

            this.adaptMinScaleToBounds(width, height);
        }

        this.applyCanvasSize(width, height, dpr);
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

    private applyCanvasSize(width: number, height: number, dpr: number) {
        for (const el of [this.canvas, this.overlay]) {
            el.width = width * dpr;
            el.height = height * dpr;
            el.style.width = `${width}px`;
            el.style.height = `${height}px`;
        }
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

            this.applyCanvasSize(width, height, nextDpr);

            this.onResize?.();
            this.onRender();
        };

        window.addEventListener("resize", this.handleWindowResize, { passive: true });
    }
}
