export type CanvasTileEngineConfig = {
    renderer?: "canvas";
    scale: number;
    maxScale?: number;
    minScale?: number;
    backgroundColor?: string;
    /** When true, center coordinates are snapped to cell centers (x.5, y.5) for pixel-perfect grid alignment */
    gridAligned?: boolean;
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
    responsive?: "preserve-scale" | "preserve-viewport" | false;
    eventHandlers?: EventHandlers;
    bounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
    coordinates?: {
        enabled?: boolean;
        shownScaleRange?: { min: number; max: number };
    };
    cursor?: {
        default?: string;
        move?: string;
    };
    debug?: {
        enabled?: boolean;
        hud?: {
            enabled?: boolean;
            topLeftCoordinates?: boolean;
            coordinates?: boolean;
            scale?: boolean;
            tilesInView?: boolean;
            fps?: boolean;
        };
        eventHandlers?: {
            click?: boolean;
            hover?: boolean;
            drag?: boolean;
            zoom?: boolean;
            resize?: boolean;
        };
    };
};

export type EventHandlers = {
    click?: boolean;
    rightClick?: boolean;
    hover?: boolean;
    drag?: boolean;
    zoom?: boolean;
    resize?: boolean;
};
