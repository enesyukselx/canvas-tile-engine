export function topLeftToCenterX(canvasWidth: number, scale: number, xCoord: number = 0): number {
    return xCoord + canvasWidth / (2 * scale) - 0.5;
}

export function topLeftToCenterY(canvasHeight: number, scale: number, yCoord: number = 0): number {
    return yCoord + canvasHeight / (2 * scale) - 0.5;
}
