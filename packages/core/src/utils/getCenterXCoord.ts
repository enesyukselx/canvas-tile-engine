export default function getCenterXCoord(canvasWidth: number, scale: number, xCoord: number = 0): number {
    return xCoord + canvasWidth / (2 * scale) - 0.5;
}
