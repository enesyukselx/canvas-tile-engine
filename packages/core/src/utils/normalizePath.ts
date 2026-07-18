import type { LineStyle, Path, PathItem } from "../types";

/**
 * Normalizes every accepted `drawPath` input into `PathItem[]`, so renderers
 * and the hit tester only ever see the item form:
 *
 * - `PathItem` / `PathItem[]` — passed through.
 * - Legacy `Coords[]` (single polyline) / `Coords[][]` — wrapped into items,
 *   with the legacy call-level stroke `style` copied onto each item.
 */
export function normalizePathItems<TData = unknown>(
    input: PathItem<TData> | PathItem<TData>[] | Path | Path[],
    legacyStyle?: LineStyle,
): PathItem<TData>[] {
    if (!Array.isArray(input)) return [input];
    if (input.length === 0) return [];

    const first = input[0];
    // PathItem[] — the item form owns its style; a legacy style argument
    // would be ambiguous, so it is ignored by the overload signatures.
    if (!Array.isArray(first) && "points" in first) return input as PathItem<TData>[];

    const paths: Path[] = Array.isArray(first) ? (input as Path[]) : [input as Path];
    return paths.map((points) => ({ points, style: legacyStyle }));
}
