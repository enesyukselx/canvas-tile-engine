export default function getInitialXCoord(canvasWidth: number, scale: number, centerXCoord: number = 0): number {
    return centerXCoord - canvasWidth / (2 * scale) + 0.5;
}
