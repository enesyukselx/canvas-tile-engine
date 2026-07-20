import { SpriteAnimator } from "@canvas-tile-engine/core";
import type { CanvasTileEngine, DrawHandle } from "@canvas-tile-engine/core";
import { objectLayerToItems, tileLayerToItems, type ObjectStyleOptions } from "./mappers";
import type { TiledMap, TiledTileset } from "./types";

export interface MountTiledMapOptions extends ObjectStyleOptions {
    /**
     * First engine layer index; Tiled layers occupy layerOffset,
     * layerOffset + 1, ... in map order. Default 0.
     */
    layerOffset?: number;
    /**
     * Resolve a tileset's image source (as written in the map file) to the
     * URL/path handed to `engine.images.load`. Default: the source as-is.
     */
    resolveImage?: (source: string, tileset: TiledTileset) => string;
    /**
     * Draw tile layers dynamically instead of through static caches.
     * Static (default) is right for maps that do not change.
     */
    dynamic?: boolean;
}

export interface TiledMount {
    map: TiledMap;
    /**
     * Draw handles per flattened layer index (a tile layer can hold several:
     * static pass + one per animated-tile group).
     */
    handles: ReadonlyMap<number, DrawHandle[]>;
    /** Stop animators and remove every registration this mount created. */
    destroy(): void;
}

/**
 * Register a parsed Tiled map on an engine: tile layers as static-cached
 * image draws (animated cells split out and driven by SpriteAnimators),
 * object layers as hit-testable paths/markers/tile images. Registration ids
 * are namespaced per mount, so re-mounting replaces instead of accumulating.
 *
 * Call `engine.render()` after mounting (and use the returned `destroy` as
 * the cleanup — it is the React-effect story).
 */
export async function mountTiledMap<TMount, TImage>(
    engine: CanvasTileEngine<TMount, TImage>,
    map: TiledMap,
    options: MountTiledMapOptions = {},
): Promise<TiledMount> {
    const { layerOffset = 0, dynamic = false } = options;

    const images = new Map<TiledTileset, TImage>();
    await Promise.all(
        map.tilesets.map(async (tileset) => {
            const src = options.resolveImage ? options.resolveImage(tileset.image, tileset) : tileset.image;
            images.set(tileset, await engine.images.load(src));
        }),
    );

    const handles = new Map<number, DrawHandle[]>();
    const animators: SpriteAnimator[] = [];

    map.layers.forEach((layer, index) => {
        const engineLayer = layerOffset + index;
        const idBase = `tiled:${index}:${layer.name}`;
        const layerHandles: DrawHandle[] = [];

        if (layer.kind === "tiles") {
            const { staticItems, animated } = tileLayerToItems(layer, images);
            if (staticItems.length > 0) {
                layerHandles.push(
                    dynamic
                        ? engine.drawImage(staticItems, engineLayer, { id: `${idBase}:static` })
                        : engine.drawStaticImage(staticItems, `${idBase}:static`, engineLayer),
                );
            }
            animated.forEach((group, k) => {
                layerHandles.push(engine.drawImage(group.items, engineLayer, { id: `${idBase}:anim:${k}` }));
                const animator = new SpriteAnimator({
                    frames: group.animation.frames,
                    fps: group.animation.fps,
                });
                animator.start((frame) => {
                    for (const item of group.items) item.sprite = frame;
                    engine.render();
                });
                animators.push(animator);
            });
        } else {
            const { paths, markers, tiles } = objectLayerToItems(layer, images, options);
            if (paths.length > 0) layerHandles.push(engine.drawPath(paths, engineLayer, { id: `${idBase}:paths` }));
            if (tiles.length > 0) layerHandles.push(engine.drawImage(tiles, engineLayer, { id: `${idBase}:tiles` }));
            if (markers.length > 0) {
                layerHandles.push(engine.drawCircle(markers, engineLayer, { id: `${idBase}:markers` }));
            }
        }
        handles.set(index, layerHandles);
    });

    let destroyed = false;
    return {
        map,
        handles,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            for (const animator of animators) animator.stop();
            // Removing a static registration also drops its offscreen cache.
            for (const layerHandles of handles.values()) {
                for (const handle of layerHandles) engine.removeDrawHandle(handle);
            }
            engine.render();
        },
    };
}
