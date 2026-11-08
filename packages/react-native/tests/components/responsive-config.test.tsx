import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";

const CONFIG: CanvasTileEngineConfig = { scale: 10, size: { width: 0, height: 0 } };
const IGNORED = /config\.responsive \("(fill|preserve-scale|preserve-viewport)"\) has no effect on React Native/;

/**
 * The warning is shown once per app session, i.e. once per module instance,
 * so every test loads a fresh copy of the component. React, the testing
 * library and the mocks are reloaded with it: the component has to render
 * through the same React copy, and record into the same mocks, as the test.
 */
async function load() {
    vi.resetModules();
    const [rtl, { CanvasTileEngine }, { useCanvasTileEngine }, { createFakeRenderer }, { emitLayout }] =
        await Promise.all([
            import("@testing-library/react"),
            import("../../src/components/CanvasTileEngine"),
            import("../../src/hooks/useCanvasTileEngine"),
            import("../helpers/fakeRenderer"),
            import("../mocks/react-native"),
        ]);

    const mount = (config: CanvasTileEngineConfig) => {
        const fake = createFakeRenderer();
        function Harness() {
            const engine = useCanvasTileEngine();
            return <CanvasTileEngine engine={engine} config={config} renderer={fake.renderer} />;
        }
        const utils = rtl.render(<Harness />);
        return { fake, ...utils };
    };

    return { act: rtl.act, cleanup: rtl.cleanup, emitLayout, mount };
}

let cleanupLoaded: (() => void) | null = null;

afterEach(() => {
    cleanupLoaded?.();
    cleanupLoaded = null;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("config.responsive on React Native", () => {
    it("warns once in development, naming the ignored mode", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { act, cleanup, emitLayout, mount } = await load();
        cleanupLoaded = cleanup;

        const first = mount({ ...CONFIG, responsive: "fill" });
        expect(warn).not.toHaveBeenCalled(); // nothing before the engine exists
        act(() => emitLayout(300, 200));
        act(() => emitLayout(400, 200));
        act(() => emitLayout(200, 400));
        first.unmount();

        // A second map built from the same shared config stays quiet.
        mount({ ...CONFIG, responsive: "preserve-viewport" });
        act(() => emitLayout(300, 200));
        act(() => emitLayout(400, 200));

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toMatch(IGNORED);
        expect(warn.mock.calls[0][0]).toContain('("fill")');
    });

    it.each([false, undefined] as const)("stays silent with responsive: %j", async (responsive) => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { act, cleanup, emitLayout, mount } = await load();
        cleanupLoaded = cleanup;

        const { fake } = mount({ ...CONFIG, responsive });
        act(() => emitLayout(300, 200));
        act(() => emitLayout(400, 200));

        expect(fake.resizeWithAnimation).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it("stays silent in production builds, and still resizes", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { act, cleanup, emitLayout, mount } = await load();
        cleanupLoaded = cleanup;
        // After loading: React itself must stay on its development build,
        // which is the only one that supports act().
        vi.stubEnv("NODE_ENV", "production");

        const { fake } = mount({ ...CONFIG, responsive: "fill" });
        act(() => emitLayout(300, 200));
        act(() => emitLayout(400, 200));

        expect(fake.resizeWithAnimation).toHaveBeenCalledWith(400, 200, 0, undefined);
        expect(warn).not.toHaveBeenCalled();
    });
});
