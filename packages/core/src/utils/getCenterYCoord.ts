export default function getCenterYCoord(canvasHeight: number, scale: number, yCoord: number = 0): number {
    return yCoord + canvasHeight / (2 * scale) - 0.5;
}
