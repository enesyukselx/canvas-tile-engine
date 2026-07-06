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
    private widthLimits: { min: number; max: number };

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

        this.viewport.updateDpr();
        this.currentDpr = this.viewport.dpr;

        if (responsiveMode === "preserve-viewport") {
            const aspectRatio = this.initialVisibleTiles.y / this.initialVisibleTiles.x;
            this.wrapper.style.width = "100%";
            this.wrapper.style.minWidth = `${this.widthLimits.min}px`;
            this.wrapper.style.maxWidth = `${this.widthLimits.max}px`;
            this.wrapper.style.minHeight = `${this.widthLimits.min * aspectRatio}px`;
            this.wrapper.style.maxHeight = `${this.widthLimits.max * aspectRatio}px`;
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

            this.camera.setScale(newScale);
            this.camera.setCenter(currentCenter, width, height);
        } else {
            const diffW = width - prev.width;
            const diffH = height - prev.height;
            this.camera.adjustForResize(diffW, diffH);
        }

        this.viewport.setSize(width, height);
        this.applyCanvasSize(width, height, dpr);
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
