import { Component, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook } from "@testing-library/react";
import { EngineContext, useEngineContext, type AnyEngineHandle } from "../src";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("useEngineContext", () => {
    it("throws outside of a CanvasTileEngine component", () => {
        // Catch with a boundary so neither React nor jsdom logs the expected
        // throw as an unhandled error; silence React's own error report.
        vi.spyOn(console, "error").mockImplementation(() => {});
        let caught: unknown;

        class Catcher extends Component<{ children?: ReactNode }, { failed: boolean }> {
            state = { failed: false };
            static getDerivedStateFromError() {
                return { failed: true };
            }
            componentDidCatch(error: Error) {
                caught = error;
            }
            render() {
                return this.state.failed ? null : this.props.children;
            }
        }

        function Probe() {
            useEngineContext();
            return null;
        }

        render(
            <Catcher>
                <Probe />
            </Catcher>,
        );

        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).message).toBe("useEngineContext must be used within a CanvasTileEngine component");
    });

    it("returns the provided context value", () => {
        const value = { engine: {} as AnyEngineHandle, requestRender: vi.fn() };
        const wrapper = ({ children }: { children: ReactNode }) => (
            <EngineContext.Provider value={value}>{children}</EngineContext.Provider>
        );

        const { result } = renderHook(() => useEngineContext(), { wrapper });
        expect(result.current).toBe(value);
    });
});
