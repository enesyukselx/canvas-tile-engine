// @vitest-environment jsdom
//
// jsdom provides `window` but no `matchMedia` at all, so this file stubs the
// query itself. That absence is also the reason core must never probe: the
// same is true on React Native, where `window` exists and `matchMedia` does
// not. The package stays on environment "node"; DOM tests opt in per file.
import { afterEach, describe, expect, it, vi } from "vitest";
import { Config } from "@canvas-tile-engine/core";
import { ReducedMotionWatcher } from "../src/dom/ReducedMotionWatcher";

type ChangeListener = (event: { matches: boolean }) => void;

/** A minimal MediaQueryList whose value tests can flip. */
function stubMatchMedia(initial: boolean) {
    const listeners = new Set<ChangeListener>();
    const mediaQuery = {
        matches: initial,
        addEventListener: vi.fn((type: string, listener: ChangeListener) => {
            if (type === "change") {
                listeners.add(listener);
            }
        }),
        removeEventListener: vi.fn((type: string, listener: ChangeListener) => {
            if (type === "change") {
                listeners.delete(listener);
            }
        }),
    };
    const matchMedia = vi.fn(() => mediaQuery);
    vi.stubGlobal("matchMedia", matchMedia);

    return {
        matchMedia,
        mediaQuery,
        listenerCount: () => listeners.size,
        emit(matches: boolean) {
            mediaQuery.matches = matches;
            for (const listener of listeners) {
                listener({ matches });
            }
        },
    };
}

function createConfig() {
    return new Config({ scale: 1, size: { width: 800, height: 600 } });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ReducedMotionWatcher", () => {
    it("pushes the current value on start", () => {
        stubMatchMedia(true);
        const config = createConfig();

        new ReducedMotionWatcher(config).start();

        expect(config.getReducedMotion()).toBe(true);
        expect(config.effectiveDuration(500)).toBe(0);
    });

    it("queries prefers-reduced-motion", () => {
        const media = stubMatchMedia(false);

        new ReducedMotionWatcher(createConfig()).start();

        expect(media.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    });

    it("tracks later changes", () => {
        const media = stubMatchMedia(false);
        const config = createConfig();
        new ReducedMotionWatcher(config).start();

        expect(config.getReducedMotion()).toBe(false);

        media.emit(true);
        expect(config.getReducedMotion()).toBe(true);

        media.emit(false);
        expect(config.getReducedMotion()).toBe(false);
    });

    it("feeds the platform slot, so an explicit preference still wins", () => {
        const media = stubMatchMedia(true);
        const config = createConfig();
        config.setReducedMotion(false);

        new ReducedMotionWatcher(config).start();
        media.emit(true);

        expect(config.getReducedMotion()).toBe(false);
    });

    it("stops listening and can be restarted without stacking listeners", () => {
        const media = stubMatchMedia(false);
        const config = createConfig();
        const watcher = new ReducedMotionWatcher(config);

        watcher.start();
        expect(media.listenerCount()).toBe(1);

        watcher.stop();
        expect(media.listenerCount()).toBe(0);

        media.emit(true);
        expect(config.getReducedMotion()).toBe(false); // no longer listening

        watcher.start();
        expect(media.listenerCount()).toBe(1);
        expect(config.getReducedMotion()).toBe(true); // re-pushed on restart
    });

    it("is idempotent while already watching", () => {
        const media = stubMatchMedia(false);
        const watcher = new ReducedMotionWatcher(createConfig());

        watcher.start();
        watcher.start();

        expect(media.listenerCount()).toBe(1);
        expect(media.matchMedia).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when the environment has no matchMedia", () => {
        vi.stubGlobal("matchMedia", undefined);
        const config = createConfig();

        expect(() => new ReducedMotionWatcher(config).start()).not.toThrow();
        expect(config.getReducedMotion()).toBe(false);
    });

    it("still pushes the current value when the query cannot be subscribed to", () => {
        const mediaQuery = { matches: true };
        vi.stubGlobal("matchMedia", () => mediaQuery);
        const config = createConfig();

        const watcher = new ReducedMotionWatcher(config);
        expect(() => watcher.start()).not.toThrow();
        expect(config.getReducedMotion()).toBe(true);
        expect(() => watcher.stop()).not.toThrow();
    });
});
