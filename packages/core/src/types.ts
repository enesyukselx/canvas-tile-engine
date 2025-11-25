export type CanvasGridMapConfig = {
    scale: number;
    maxScale: number;
    minScale: number;
    size: {
        width: number;
        height: number;
    };
    backgroundColor?: string;
    events: {
        click?: boolean;
        hover?: boolean;
        drag?: boolean;
        zoom?: boolean;
        resize?: boolean;
    };
    showCoordinates?: boolean;
    minScaleShowCoordinates?: number;
    cursor?: {
        default?: string;
        move?: string;
    };
};

export type CanvasGridMapDrawCallback = (
    ctx: CanvasRenderingContext2D,
    opts: { scale: number; width: number; height: number; coords: Coords }
) => void;

export type Coords = {
    x: number;
    y: number;
};
