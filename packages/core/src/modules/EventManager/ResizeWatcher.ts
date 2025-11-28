import { Camera } from "../Camera";
import { Config } from "../Config";
import { ViewportState } from "../ViewportState";

/**
 * Observes canvas resizing and keeps viewport/camera in sync.
 * @internal
 */
export class ResizeWatcher {
    private wrapper?: HTMLDivElement;
    private resizeObserver?: ResizeObserver;

    public onResize?: () => void;

    constructor(
        private canvas: HTMLCanvasElement,
        private viewport: ViewportState,
        private camera: Camera,
        private config: Config,
        private onCameraChange: () => void
    ) {}

    start() {
        const wrapper = document.createElement("div");
        const size = this.viewport.getSize();

        Object.assign(wrapper.style, {
            resize: "both",
            overflow: "hidden",
            width: `${size.width}px`,
            height: `${size.height}px`,
            touchAction: "none",
            position: "relative",
        });

        if (this.canvas.parentNode) {
            this.canvas.parentNode.insertBefore(wrapper, this.canvas);
            wrapper.appendChild(this.canvas);
        }

        this.wrapper = wrapper;
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const prev = this.viewport.getSize();
                const diffW = width - prev.width;
                const diffH = height - prev.height;

                this.camera.adjustForResize(diffW, diffH);
                this.viewport.setSize(width, height);
                this.canvas.width = width;
                this.canvas.height = height;

                if (this.onResize) {
                    this.onResize();
                }
                this.onCameraChange();
            }
        });

        this.resizeObserver.observe(wrapper);
    }

    stop() {
        if (this.resizeObserver && this.wrapper) {
            this.resizeObserver.unobserve(this.wrapper);
            this.resizeObserver.disconnect();
        }

        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.insertBefore(this.canvas, this.wrapper);
            this.wrapper.parentNode.removeChild(this.wrapper);
        }

        this.wrapper = undefined;
        this.resizeObserver = undefined;
    }
}
