import { describe, expect, it, vi } from "vitest";
import type { GestureProcessor } from "@canvas-tile-engine/core";
import { createKeyDownHandler } from "../src/dom/keyDownHandler";

function createFakeProcessor(consumed: boolean) {
    const handleKeyDown = vi.fn(() => consumed);
    return { processor: { handleKeyDown } as unknown as GestureProcessor, handleKeyDown };
}

function createKeyEvent(init: Partial<KeyboardEvent> & { key: string }) {
    return {
        key: init.key,
        shiftKey: init.shiftKey ?? false,
        ctrlKey: init.ctrlKey ?? false,
        metaKey: init.metaKey ?? false,
        altKey: init.altKey ?? false,
        preventDefault: vi.fn(),
    } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("createKeyDownHandler", () => {
    it("forwards the key and every modifier core needs to decide", () => {
        const { processor, handleKeyDown } = createFakeProcessor(true);

        createKeyDownHandler(processor)(createKeyEvent({ key: "+", shiftKey: true, altKey: true }));

        expect(handleKeyDown).toHaveBeenCalledWith({
            key: "+",
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
            altKey: true,
        });
    });

    it("preventDefaults a key the engine consumed", () => {
        const { processor } = createFakeProcessor(true);
        const event = createKeyEvent({ key: "ArrowRight" });

        createKeyDownHandler(processor)(event);

        expect(event.preventDefault).toHaveBeenCalled();
    });

    // The no-trap contract: Tab, Escape and every screen-reader shortcut reach
    // the browser untouched because core reports them unconsumed.
    it("leaves a key the engine did not consume alone", () => {
        const { processor } = createFakeProcessor(false);
        const event = createKeyEvent({ key: "Tab" });

        createKeyDownHandler(processor)(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});
