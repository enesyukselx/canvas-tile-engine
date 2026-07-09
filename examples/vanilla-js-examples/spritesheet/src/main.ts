import {
    CanvasTileEngine,
    SpriteAnimator,
    SpriteSheet,
    type CanvasTileEngineConfig,
    type ImageItem,
} from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

// dragon.png: 432x512 sheet, 3 columns x 4 rows -> 144x128 per frame.
// Each row is one flap cycle of a different flight direction.
const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });
const ANIMATION_FPS = 8;

const config: CanvasTileEngineConfig = {
    scale: 60,
    minScale: 25,
    maxScale: 150,
    size: { width: 800, height: 600 },
    backgroundColor: "#0f2027",
    eventHandlers: {
        zoom: true,
        drag: true,
        click: true,
    },
};

const wrapper = document.getElementById("map-wrapper") as HTMLDivElement;
const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), { x: 6, y: 4.5 });

async function main() {
    const img = await engine.images.load("/dragon.png");

    engine.drawGridLines(1, 1, "rgba(255,255,255,0.08)");

    // ─── Static frames: pick single frames from the sheet, no animation ───
    const staticItems: ImageItem[] = [];
    for (let row = 0; row < 4; row++) {
        staticItems.push({ x: 8, y: row + 1, size: 1, img, sprite: sheet.frame(0, row) });
    }
    engine.drawImage(staticItems);

    // ─── Animated dragons: one per sheet row, driven by SpriteAnimator ───
    const dragons = [
        { x: 1, y: 2, size: 1, row: 0 },
        { x: 2, y: 2, size: 1, row: 1 },
        { x: 3, y: 2, size: 1, row: 2 },
        { x: 4, y: 2, size: 1, row: 3 },
    ];

    const controllers: Array<{ item: ImageItem; animator: SpriteAnimator }> = [];
    for (const dragon of dragons) {
        const item: ImageItem = {
            x: dragon.x,
            y: dragon.y,
            size: dragon.size,
            img,
            sprite: sheet.frame(0, dragon.row),
        };
        engine.drawImage(item);

        const animator = new SpriteAnimator({
            frames: sheet.framesInRow(dragon.row, 0, 2),
            fps: ANIMATION_FPS,
        });
        controllers.push({ item, animator });
    }

    const play = ({ item, animator }: (typeof controllers)[0]) => {
        animator.start((frame) => {
            item.sprite = frame;
            engine.render();
        });
    };

    controllers.forEach(play);
    engine.render();

    // Pause/resume playback on click anywhere in the map
    engine.onClick = () => {
        for (const controller of controllers) {
            if (controller.animator.isRunning()) {
                controller.animator.stop();
            } else {
                play(controller);
            }
        }
    };
}

void main();
