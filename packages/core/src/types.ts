export type GridEngineConfig = {
    renderer?: "canvas";
    scale: number;
    maxScale: number;
    minScale: number;
    backgroundColor?: string;
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
    eventHandlers?: {
        click?: boolean;
        hover?: boolean;
        drag?: boolean;
        zoom?: boolean;
        resize?: boolean;
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
            topLeftCoordinates?: boolean;
            coordinates?: boolean;
            scale?: boolean;
            tilesInView?: boolean;
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

export type Coords = {
    x: number;
    y: number;
};

export type onDrawCallback = (
    ctx: CanvasRenderingContext2D,
    info: { scale: number; width: number; height: number; coords: Coords }
) => void;

export type onClickCallback = (
    coords: {
        raw: Coords;
        snapped: Coords;
    },
    mouse: {
        raw: Coords;
        snapped: Coords;
    },
    client: {
        raw: Coords;
        snapped: Coords;
    }
) => void;

export type onHoverCallback = onClickCallback;
