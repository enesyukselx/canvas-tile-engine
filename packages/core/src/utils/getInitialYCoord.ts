export default function getInitialYCoord(canvasHeight: number, scale: number, centerYCoord: number = 0): number {
    return centerYCoord - canvasHeight / (2 * scale) + 0.5;
}
