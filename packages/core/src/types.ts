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
};

export type Coords = {
    x: number;
    y: number;
};
