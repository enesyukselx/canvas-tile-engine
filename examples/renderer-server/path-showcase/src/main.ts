import { renderToBuffer } from "@canvas-tile-engine/renderer-server";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { labelItems, lineItems, pathItems, type ShapeData } from "./scene";

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "output");

// The scene spans roughly x 0..41, y 0..22 in world units.
const buffer = await renderToBuffer({
    config: {
        scale: 42,
        size: { width: 1760, height: 1000 },
        backgroundColor: "#0f172a",
    },
    center: { x: 21, y: 11 },
    pixelRatio: 2,
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#1e293b", 0);
        engine.drawGridLines(5, 1, "#334155", 0);
        engine.drawPath(pathItems, 1);
        engine.drawLine(lineItems, { strokeStyle: "#f472b6", lineWidthPx: 4, lineDash: [0.4, 0.2] }, 1);
        engine.drawText(labelItems, 2);

        // Hit testing is fully headless — the same registry the browser uses.
        // hitTest takes event-space points (`coords.raw`, corner space where
        // cell k spans [k, k+1]); +0.5 converts our item-space scene coords.
        const probe = (label: string, x: number, y: number) => {
            const hit = engine.hitTestFirst<ShapeData>({ x: x + 0.5, y: y + 0.5 });
            console.log(`${label.padEnd(28)} -> ${hit ? `${hit.kind}: ${hit.item.data?.name}` : "(no hit)"}`);
        };
        probe("nonzero star center", 11.5, 3);
        probe("evenodd star center (hole)", 17.5, 3);
        probe("metro curve apex", 7.5, 11.375);
        probe("metro chord (not the curve)", 7.5, 12.9);
        probe("plaza band", 19.5, 12);
        probe("plaza hole center", 22, 13.75);
        probe("balcony band (top)", 37.5, 11.2);
        probe("balcony inner void", 37.5, 14);
    },
});

await mkdir(OUTPUT_DIR, { recursive: true });
const outFile = join(OUTPUT_DIR, "path-showcase.png");
await writeFile(outFile, buffer);
console.log(`\nWrote ${outFile} (${(buffer.length / 1024).toFixed(0)} KB)`);
