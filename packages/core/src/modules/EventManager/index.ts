import { onClickCallback, onHoverCallback } from "../../types";
import { Camera, ICamera } from "../Camera";
import { Config } from "../Config";
import { CoordinateTransformer } from "../CoordinateTransformer";
import { ViewportState } from "../ViewportState";
import { EventBinder } from "./EventBinder";
import { GestureController } from "./GestureController";
import { ResizeWatcher } from "./ResizeWatcher";

/**
 * Coordinates DOM binding, gesture handling, and resize observation.
 * @internal
 */
export class EventManager {
    private binder: EventBinder;
    private gestures: GestureController;
    private resizeWatcher?: ResizeWatcher;

    public onResize?: () => void;

    public get onClick(): onClickCallback | undefined {
        return this.gestures.onClick;
    }
    public set onClick(cb: onClickCallback | undefined) {
        this.gestures.onClick = cb;
    }

    public get onHover(): onHoverCallback | undefined {
        return this.gestures.onHover;
    }
    public set onHover(cb: onHoverCallback | undefined) {
        this.gestures.onHover = cb;
    }

    public get onMouseLeave(): (() => void) | undefined {
        return this.gestures.onMouseLeave;
    }
    public set onMouseLeave(cb: (() => void) | undefined) {
        this.gestures.onMouseLeave = cb;
    }

    constructor(
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private coordinateTransformer: CoordinateTransformer,
        private onCameraChange: () => void
    ) {
        this.gestures = new GestureController(
            this.canvas,
            this.camera,
            this.viewport,
            this.config,
            this.coordinateTransformer,
            this.onCameraChange
        );

        this.binder = new EventBinder(this.canvas, {
            click: this.gestures.handleClick,
            mousedown: this.gestures.handleMouseDown,
            mousemove: this.gestures.handleMouseMove,
            mouseup: this.gestures.handleMouseUp,
            mouseleave: this.gestures.handleMouseUp,
            wheel: this.gestures.handleWheel,
            touchstart: this.gestures.handleTouchStart,
            touchmove: this.gestures.handleTouchMove,
            touchend: this.gestures.handleTouchEnd,
        });
    }

    setupEvents() {
        this.binder.attach();
        if (this.config.get().eventHandlers.resize && this.camera instanceof Camera) {
            this.resizeWatcher = new ResizeWatcher(
                this.canvas,
                this.viewport,
                this.camera,
                this.config,
                this.onCameraChange
            );
            this.resizeWatcher.onResize = () => {
                if (this.onResize) {
                    this.onResize();
                }
            };
            this.resizeWatcher.start();
        }
    }

    destroy() {
        this.binder.detach();
        this.resizeWatcher?.stop();
    }
}
