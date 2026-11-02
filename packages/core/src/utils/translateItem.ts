import type { Coords, PathCommand } from "../types";
import type { BoundedItem, AnchoredItem, EndpointItem, OutlineItem } from "./itemBounds";

/** Geometry accepted by translateItem; all six dynamic primitive item types fit. */
export type TranslatableItem = BoundedItem;

function translateCommand(command: PathCommand, dx: number, dy: number): PathCommand {
    switch (command.type) {
        case "closePath":
            return command;
        case "quadraticCurveTo":
            return { ...command, x: command.x + dx, y: command.y + dy, cpx: command.cpx + dx, cpy: command.cpy + dy };
        case "bezierCurveTo":
            return {
                ...command,
                x: command.x + dx,
                y: command.y + dy,
                cp1x: command.cp1x + dx,
                cp1y: command.cp1y + dy,
                cp2x: command.cp2x + dx,
                cp2y: command.cp2y + dy,
            };
        default:
            return { ...command, x: command.x + dx, y: command.y + dy };
    }
}

/**
 * Return an immutably translated item, preserving its data, style, sizes and
 * rotation. Lines move both endpoints; paths move every vertex/control point
 * and arc center. Delta is in item/world units, not screen pixels.
 */
export function translateItem<T extends TranslatableItem>(item: Readonly<T>, delta: Coords): T {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
        throw new RangeError("Translation must be finite");
    }
    const point = (p: Coords): Coords => ({ x: p.x + delta.x, y: p.y + delta.y });
    const endpoints = item as Partial<EndpointItem>;
    if (endpoints.from && endpoints.to) {
        return { ...item, from: point(endpoints.from), to: point(endpoints.to) } as T;
    }
    const outline = item as OutlineItem;
    if (outline.commands !== undefined || outline.points !== undefined) {
        return {
            ...item,
            ...(outline.commands !== undefined
                ? { commands: outline.commands.map((c) => translateCommand(c, delta.x, delta.y)) }
                : {}),
            ...(outline.points !== undefined ? { points: outline.points.map(point) } : {}),
        } as T;
    }
    const anchored = item as Partial<AnchoredItem>;
    if (typeof anchored.x === "number" && typeof anchored.y === "number") {
        return { ...item, ...point({ x: anchored.x, y: anchored.y }) } as T;
    }
    throw new TypeError("Item has no supported translation geometry");
}

/** @internal A stable authored anchor for group grid snapping. */
export function translationAnchor(item: Readonly<TranslatableItem>): Coords {
    const endpoints = item as Partial<EndpointItem>;
    if (endpoints.from) {
        return { ...endpoints.from };
    }
    const outline = item as OutlineItem;
    if (outline.commands !== undefined) {
        const command = outline.commands.find((c) => c.type !== "closePath");
        return command ? { x: command.x, y: command.y } : { x: 0, y: 0 };
    }
    if (outline.points !== undefined) {
        return { ...(outline.points[0] ?? { x: 0, y: 0 }) };
    }
    const anchored = item as AnchoredItem;
    return { x: anchored.x, y: anchored.y };
}
