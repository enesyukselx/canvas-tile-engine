import { useEffect, useRef, type ReactNode } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import styles from "./index.module.css";

const GITHUB_URL = "https://github.com/enesyukselx/canvas-tile-engine";

const packages = [
    { label: "Core", to: "/docs/introduction/getting_started", tone: "amber" },
    { label: "Canvas2D", to: "/docs/js/installation", tone: "sky" },
    { label: "WebGL", to: "/docs/introduction/renderers", tone: "violet" },
    { label: "React", to: "/docs/react/installation", tone: "rose" },
    { label: "React Native", to: "/docs/react-native/installation", tone: "indigo" },
    { label: "Server", to: "/docs/server/rendering", tone: "fuchsia" },
];

const TILE = 44;
const PALETTE = ["#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981", "#f43f5e", "#6366f1"];
const MAX_CELLS = 90;
const DRIFT_X = 5;
const DRIFT_Y = 3;

type Cell = {
    col: number;
    row: number;
    color: string;
    born: number;
    ttl: number;
};

function tilePath(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const inset = 3;
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2, 5);
}

function HeroCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        let width = 0;
        let height = 0;
        let dpr = 1;
        let raf = 0;
        let lastSpawn = 0;
        let lastPainted = "";
        let paletteIndex = 0;
        const cells: Cell[] = [];
        const pointer = { x: -1, y: -1, active: false };

        const offsets = (now: number) =>
            reducedMotion
                ? { ox: 0, oy: 0 }
                : {
                      ox: (now / 1000) * DRIFT_X,
                      oy: (now / 1000) * DRIFT_Y,
                  };

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        };

        const spawn = (now: number, ttl: number) => {
            const { ox, oy } = offsets(now);
            const col = Math.floor(ox / TILE) + Math.floor(Math.random() * (Math.ceil(width / TILE) + 1));
            const row = Math.floor(oy / TILE) + Math.floor(Math.random() * (Math.ceil(height / TILE) + 1));

            cells.push({
                col,
                row,
                color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
                born: now,
                ttl,
            });
        };

        const draw = (now: number) => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            const { ox, oy } = offsets(now);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(9, 9, 11, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let x = -(ox % TILE); x <= width; x += TILE) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }

            for (let y = -(oy % TILE); y <= height; y += TILE) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }

            ctx.stroke();

            const baseAlpha = isDark ? 0.32 : 0.22;
            for (let i = cells.length - 1; i >= 0; i--) {
                const cell = cells[i];
                const age = now - cell.born;

                if (age > cell.ttl) {
                    cells.splice(i, 1);
                    continue;
                }

                const t = age / cell.ttl;
                const envelope = !Number.isFinite(cell.ttl) ? 1 : t < 0.2 ? t / 0.2 : t > 0.6 ? (1 - t) / 0.4 : 1;
                const x = cell.col * TILE - ox;
                const y = cell.row * TILE - oy;

                if (x < -TILE || x > width || y < -TILE || y > height) continue;

                ctx.globalAlpha = envelope * baseAlpha;
                ctx.fillStyle = cell.color;
                tilePath(ctx, x, y);
                ctx.fill();
            }

            ctx.globalAlpha = 1;

            if (pointer.active) {
                const col = Math.floor((pointer.x + ox) / TILE);
                const row = Math.floor((pointer.y + oy) / TILE);
                const x = col * TILE - ox;
                const y = row * TILE - oy;

                ctx.globalAlpha = isDark ? 0.45 : 0.35;
                ctx.fillStyle = "#f59e0b";
                tilePath(ctx, x, y);
                ctx.fill();
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = "#f59e0b";
                ctx.lineWidth = 1.5;
                tilePath(ctx, x, y);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        };

        const frame = (now: number) => {
            if (cells.length < MAX_CELLS && now - lastSpawn > 260) {
                lastSpawn = now;
                spawn(now, 2600 + Math.random() * 3400);
            }

            draw(now);
            raf = requestAnimationFrame(frame);
        };

        const onPointerMove = (event: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;

            if (!pointer.active) return;

            const now = performance.now();
            const { ox, oy } = offsets(now);
            const col = Math.floor((pointer.x + ox) / TILE);
            const row = Math.floor((pointer.y + oy) / TILE);
            const key = `${col}:${row}`;

            if (key !== lastPainted) {
                lastPainted = key;
                cells.push({
                    col,
                    row,
                    color: PALETTE[paletteIndex++ % PALETTE.length],
                    born: now,
                    ttl: 1400,
                });
            }
        };

        resize();

        const resizeObserver = new ResizeObserver(() => {
            resize();
            if (reducedMotion) draw(performance.now());
        });
        resizeObserver.observe(canvas);

        const themeObserver = new MutationObserver(() => draw(performance.now()));
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        if (reducedMotion) {
            const now = performance.now();
            for (let i = 0; i < 14; i++) spawn(now, Infinity);
            draw(now);
        } else {
            window.addEventListener("pointermove", onPointerMove, { passive: true });
            raf = requestAnimationFrame(frame);
        }

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", onPointerMove);
            resizeObserver.disconnect();
            themeObserver.disconnect();
        };
    }, []);

    return <canvas ref={canvasRef} aria-hidden className={styles.heroCanvas} />;
}

function TileWord({ children }: { children: string }) {
    return (
        <span className={styles.tileWord}>
            <span className={styles.tileWordFrame} aria-hidden />
            <span className={styles.tileCornerTopLeft} aria-hidden />
            <span className={styles.tileCornerTopRight} aria-hidden />
            <span className={styles.tileCornerBottomLeft} aria-hidden />
            <span className={styles.tileCornerBottomRight} aria-hidden />
            <span className={styles.tileWordText}>{children}</span>
        </span>
    );
}

function HomepageHeader() {
    return (
        <header className={styles.heroBanner}>
            <HeroCanvas />
            <div className={styles.heroContent}>
                <p className={styles.eyebrow}>Documentation</p>
                <h1 className={styles.heroTitle}>
                    Canvas
                    <TileWord>Tile</TileWord>
                    Engine Docs
                </h1>
                <p className={styles.heroSubtitle}>
                    Build zoomable 2D maps, game boards, editors, minimaps, and dense grid UIs with a renderer-agnostic
                    TypeScript engine. These docs cover the camera, drawing API, events, renderers, React bindings, and
                    server snapshots.
                </p>
                <div className={styles.buttons}>
                    <Link className={styles.primaryButton} to="/docs/introduction/getting_started">
                        Start reading
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M6 12L10 8L6 4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </Link>
                    <Link className={styles.secondaryButton} to="https://www.canvastileengine.com/playground">
                        Playground
                    </Link>
                    <Link className={styles.secondaryButton} to={GITHUB_URL}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
                            />
                        </svg>
                        GitHub
                    </Link>
                </div>
                <div className={styles.packageBlock}>
                    <p className={styles.packageLabel}>Packages</p>
                    <ul className={styles.packageList}>
                        {packages.map((pkg) => (
                            <li key={pkg.label}>
                                <Link className={`${styles.packageChip} ${styles[pkg.tone]}`} to={pkg.to}>
                                    {pkg.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </header>
    );
}

export default function Home(): ReactNode {
    return (
        <Layout
            title="Canvas Tile Engine Documentation"
            description="Renderer-agnostic TypeScript tile engine documentation for zoomable maps, game boards, editors, minimaps, and grid UIs."
        >
            <HomepageHeader />
            <main>
                <HomepageFeatures />
            </main>
        </Layout>
    );
}
