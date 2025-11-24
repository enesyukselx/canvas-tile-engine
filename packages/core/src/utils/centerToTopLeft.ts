export function centerToTopLeftX(canvasWidth: number, scale: number, centerXCoord: number = 0): number {
    return centerXCoord - canvasWidth / (2 * scale) + 0.5;
}

export function centerToTopLeftY(canvasHeight: number, scale: number, centerYCoord: number = 0): number {
    return centerYCoord - canvasHeight / (2 * scale) + 0.5;
}
