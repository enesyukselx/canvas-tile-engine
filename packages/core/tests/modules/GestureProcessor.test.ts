import { describe, expect, it, vi, beforeEach } from "vitest";
import { GestureProcessor, NormalizedPointer, CanvasBounds } from "../../src/modules/GestureProcessor";
import { ICamera } from "../../src/modules/Camera";
import { Config } from "../../src/modules/Config";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";

describe("GestureProcessor", () => {
    let mockCamera: ICamera;
    let config: Config;
    let transformer: CoordinateTransformer;
    let processor: GestureProcessor;
    let onCameraChange: () => void;
    let canvasBounds: CanvasBounds;
    let panMock: (deltaScreenX: number, deltaScreenY: number) => void;
    let zoomMock: (mouseX: number, mouseY: number, deltaY: number, canvasRect: DOMRect) => void;
    let zoomByFactorMock: (factor: number, centerX: number, centerY: number) => void;

    const createPointer = (x: number, y: number, clientX?: number, clientY?: number): NormalizedPointer => ({
        x,
        y,
        clientX: clientX ?? x,
        clientY: clientY ?? y,
    });

    beforeEach(() => {
        panMock = vi.fn();
        zoomMock = vi.fn();
        zoomByFactorMock = vi.fn();

        mockCamera = {
            x: 0,
            y: 0,
            scale: 1,
            pan: panMock,
            zoom: zoomMock,
            zoomByFactor: zoomByFactorMock,
            getCenter: vi.fn(() => ({ x: 0, y: 0 })),
            setCenter: vi.fn(),
            adjustForResize: vi.fn(),
            setScale: vi.fn(),
            setScaleLimits: vi.fn(),
            getVisibleBounds: vi.fn(() => ({ minX: 0, maxX: 100, minY: 0, maxY: 100 })),
        };

        config = new Config({
            scale: 1,
            size: { width: 800, height: 600 },
            eventHandlers: {
                click: true,
                rightClick: true,
                hover: true,
                drag: true,
                zoom: true,
            },
        });

        transformer = new CoordinateTransformer(mockCamera);
        onCameraChange = vi.fn();
        canvasBounds = {
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            bottom: 600,
            right: 800,
        };

        processor = new GestureProcessor(mockCamera, config, transformer, () => canvasBounds, onCameraChange);
    });

    describe("handleClick", () => {
        it("calls onClick callback with processed coordinates", () => {
            const onClick = vi.fn();
            processor.onClick = onClick;

            processor.handleClick(createPointer(100, 100));

            expect(onClick).toHaveBeenCalledTimes(1);
            expect(onClick).toHaveBeenCalledWith(
                expect.objectContaining({ raw: expect.any(Object) as unknown, snapped: expect.any(Object) as unknown }),
                expect.objectContaining({ raw: expect.any(Object) as unknown, snapped: expect.any(Object) as unknown }),
                expect.objectContaining({ raw: expect.any(Object) as unknown, snapped: expect.any(Object) as unknown }),
                { source: "pointer" },
            );
        });

        it("does not call onClick when click is disabled", () => {
            const onClick = vi.fn();
            processor.onClick = onClick;
            config.updateEventHandlers({ click: false });

            processor.handleClick(createPointer(100, 100));

            expect(onClick).not.toHaveBeenCalled();
        });

        it("does not call onClick when callback is not set", () => {
            // No callback set
            expect(() => processor.handleClick(createPointer(100, 100))).not.toThrow();
        });

        it("prevents click after drag", () => {
            const onClick = vi.fn();
            processor.onClick = onClick;

            processor.handlePointerDown(createPointer(100, 100));
            processor.handlePointerMove(createPointer(150, 150, 150, 150)); // Move to trigger drag
            processor.handlePointerUp(createPointer(150, 150));
            processor.handleClick(createPointer(150, 150));

            expect(onClick).not.toHaveBeenCalled();
        });
    });

    describe("handleRightClick", () => {
        it("calls onRightClick callback", () => {
            const onRightClick = vi.fn();
            processor.onRightClick = onRightClick;

            processor.handleRightClick(createPointer(100, 100));

            expect(onRightClick).toHaveBeenCalledTimes(1);
        });

        it("does not call onRightClick when disabled", () => {
            const onRightClick = vi.fn();
            processor.onRightClick = onRightClick;
            config.updateEventHandlers({ rightClick: false });

            processor.handleRightClick(createPointer(100, 100));

            expect(onRightClick).not.toHaveBeenCalled();
        });
    });

    describe("handlePointerDown / handlePointerUp", () => {
        it("calls onMouseDown callback", () => {
            const onMouseDown = vi.fn();
            processor.onMouseDown = onMouseDown;

            processor.handlePointerDown(createPointer(100, 100));

            expect(onMouseDown).toHaveBeenCalledTimes(1);
        });

        it("calls onMouseUp callback", () => {
            const onMouseUp = vi.fn();
            processor.onMouseUp = onMouseUp;

            processor.handlePointerUp(createPointer(100, 100));

            expect(onMouseUp).toHaveBeenCalledTimes(1);
        });

        it("starts drag mode on pointer down when drag is enabled", () => {
            processor.handlePointerDown(createPointer(100, 100));
            expect(processor.dragging).toBe(true);
        });

        it("does not start drag when drag is disabled", () => {
            config.updateEventHandlers({ drag: false });
            processor.handlePointerDown(createPointer(100, 100));
            expect(processor.dragging).toBe(false);
        });

        it("ends drag mode on pointer up", () => {
            processor.handlePointerDown(createPointer(100, 100));
            processor.handlePointerUp(createPointer(100, 100));
            expect(processor.dragging).toBe(false);
        });
    });

    describe("handlePointerMove", () => {
        it("calls onHover when not dragging", () => {
            const onHover = vi.fn();
            processor.onHover = onHover;

            processor.handlePointerMove(createPointer(100, 100));

            expect(onHover).toHaveBeenCalledTimes(1);
        });

        it("does not call onHover when hover is disabled", () => {
            const onHover = vi.fn();
            processor.onHover = onHover;
            config.updateEventHandlers({ hover: false });

            processor.handlePointerMove(createPointer(100, 100));

            expect(onHover).not.toHaveBeenCalled();
        });

        it("pans camera when dragging", () => {
            processor.handlePointerDown(createPointer(100, 100, 100, 100));
            processor.handlePointerMove(createPointer(150, 120, 150, 120));

            expect(panMock).toHaveBeenCalledWith(50, 20);
            expect(onCameraChange).toHaveBeenCalled();
        });

        it("does not pan when not dragging", () => {
            processor.handlePointerMove(createPointer(150, 120));

            expect(panMock).not.toHaveBeenCalled();
        });
    });

    describe("handlePointerLeave", () => {
        it("calls onMouseLeave callback", () => {
            const onMouseLeave = vi.fn();
            processor.onMouseLeave = onMouseLeave;

            processor.handlePointerLeave(createPointer(100, 100));

            expect(onMouseLeave).toHaveBeenCalledTimes(1);
        });

        it("ends drag mode", () => {
            processor.handlePointerDown(createPointer(100, 100));
            processor.handlePointerLeave(createPointer(100, 100));
            expect(processor.dragging).toBe(false);
        });
    });

    describe("handleWheel", () => {
        it("zooms camera on wheel event", () => {
            processor.handleWheel(createPointer(100, 100, 100, 100), -50);

            expect(zoomMock).toHaveBeenCalled();
            expect(onCameraChange).toHaveBeenCalled();
        });

        it("calls onZoom callback", () => {
            const onZoom = vi.fn();
            processor.onZoom = onZoom;

            processor.handleWheel(createPointer(100, 100), -50);

            expect(onZoom).toHaveBeenCalledWith(mockCamera.scale);
        });

        it("does not zoom when zoom is disabled", () => {
            config.updateEventHandlers({ zoom: false });

            processor.handleWheel(createPointer(100, 100), -50);

            expect(zoomMock).not.toHaveBeenCalled();
        });

        it("anchors zoom at the pointer in pointer mode", () => {
            config.updateEventHandlers({ zoom: "pointer" });

            processor.handleWheel(createPointer(100, 100, 120, 130), -50);

            expect(zoomMock).toHaveBeenCalledWith(120, 130, -50, canvasBounds);
        });

        it("anchors zoom at the canvas center in center mode", () => {
            config.updateEventHandlers({ zoom: "center" });

            processor.handleWheel(createPointer(100, 100, 120, 130), -50);

            // Canvas is 800x600 at (0, 0), so its center is (400, 300)
            expect(zoomMock).toHaveBeenCalledWith(400, 300, -50, canvasBounds);
        });
    });

    describe("onWheel callback", () => {
        const coordsShape = expect.objectContaining({
            raw: expect.any(Object) as unknown,
            snapped: expect.any(Object) as unknown,
        }) as unknown;

        it("fires on wheel with coords and gesture info", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;

            processor.handleWheel(createPointer(100, 100), -50);

            expect(onWheel).toHaveBeenCalledTimes(1);
            expect(onWheel).toHaveBeenCalledWith(coordsShape, coordsShape, coordsShape, {
                deltaY: -50,
                direction: "in",
                source: "wheel",
            });
        });

        it("reports direction out for positive wheel delta", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;

            processor.handleWheel(createPointer(100, 100), 50);

            expect(onWheel).toHaveBeenCalledWith(
                coordsShape,
                coordsShape,
                coordsShape,
                expect.objectContaining({ direction: "out" }),
            );
        });

        it("does not fire on a wheel event with zero deltaY", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;

            processor.handleWheel(createPointer(100, 100), 0);

            expect(onWheel).not.toHaveBeenCalled();
        });

        it("does not fire when zoom is disabled", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;
            config.updateEventHandlers({ zoom: false });

            processor.handleWheel(createPointer(100, 100), -50);

            expect(onWheel).not.toHaveBeenCalled();
        });

        it("fires on pinch with the midpoint position and a factor-equivalent delta", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;

            // Distance grows from ~141 to ~283: factor 2 (zoom in)
            processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
            processor.handleTouchMove([createPointer(50, 50, 50, 50), createPointer(250, 250, 250, 250)]);

            expect(onWheel).toHaveBeenCalledTimes(1);
            const [coords, mouse, , wheel] = onWheel.mock.calls[0] as [
                unknown,
                { raw: { x: number; y: number } },
                unknown,
                { deltaY: number; direction: string; source: string },
            ];
            expect(coords).toEqual(coordsShape);
            // Pinch midpoint is (150, 150), canvas offset is (0, 0)
            expect(mouse.raw).toEqual({ x: 150, y: 150 });
            expect(wheel.source).toBe("pinch");
            expect(wheel.direction).toBe("in");
            // The synthesized delta must reproduce the pinch factor through
            // the wheel formula: factor = exp(-deltaY * sensitivity)
            expect(Math.exp(-wheel.deltaY * 0.001)).toBeCloseTo(2);
        });

        it("reports direction out when the pinch closes", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;

            processor.handleTouchStart([createPointer(50, 50, 50, 50), createPointer(250, 250, 250, 250)]);
            processor.handleTouchMove([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);

            expect(onWheel).toHaveBeenCalledWith(
                coordsShape,
                coordsShape,
                coordsShape,
                expect.objectContaining({ direction: "out", source: "pinch" }),
            );
        });

        it("does not fire when a pinch moves without changing distance", () => {
            const onWheel = vi.fn();
            processor.onWheel = onWheel;

            processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
            // Both fingers shift +60 on x: midpoint moves, distance unchanged
            processor.handleTouchMove([createPointer(160, 100, 160, 100), createPointer(260, 200, 260, 200)]);

            expect(onWheel).not.toHaveBeenCalled();
        });
    });

    describe("touch handlers", () => {
        describe("handleTouchStart", () => {
            it("starts drag mode with single finger", () => {
                processor.handleTouchStart([createPointer(100, 100)]);
                expect(processor.dragging).toBe(true);
            });

            it("starts pinch mode with two fingers", () => {
                processor.handleTouchStart([createPointer(100, 100), createPointer(200, 200)]);
                expect(processor.pinching).toBe(true);
                expect(processor.dragging).toBe(false);
            });

            it("calls onMouseDown for single finger", () => {
                const onMouseDown = vi.fn();
                processor.onMouseDown = onMouseDown;

                processor.handleTouchStart([createPointer(100, 100)]);

                expect(onMouseDown).toHaveBeenCalledTimes(1);
            });
        });

        describe("handleTouchMove", () => {
            it("pans with single finger drag", () => {
                processor.handleTouchStart([createPointer(100, 100, 100, 100)]);
                processor.handleTouchMove([createPointer(150, 150, 150, 150)]);

                expect(panMock).toHaveBeenCalledWith(50, 50);
            });

            it("zooms with two finger pinch", () => {
                processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
                // Spread fingers apart (zoom in)
                processor.handleTouchMove([createPointer(50, 50, 50, 50), createPointer(250, 250, 250, 250)]);

                expect(zoomByFactorMock).toHaveBeenCalled();
            });

            it("anchors pinch zoom at the pinch midpoint in pointer mode", () => {
                config.updateEventHandlers({ zoom: "pointer" });

                processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
                processor.handleTouchMove([createPointer(50, 50, 50, 50), createPointer(250, 250, 250, 250)]);

                // Pinch midpoint is (150, 150), canvas offset is (0, 0)
                expect(zoomByFactorMock).toHaveBeenCalledWith(expect.any(Number), 150, 150);
            });

            it("anchors pinch zoom at the canvas center in center mode", () => {
                config.updateEventHandlers({ zoom: "center" });

                processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
                processor.handleTouchMove([createPointer(50, 50, 50, 50), createPointer(250, 250, 250, 250)]);

                // Canvas is 800x600, so its center is (400, 300)
                expect(zoomByFactorMock).toHaveBeenCalledWith(expect.any(Number), 400, 300);
            });

            it("pans when the pinch midpoint moves in pointer mode", () => {
                config.updateEventHandlers({ zoom: "pointer" });

                processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
                // Both fingers shift +60 on x: midpoint moves (150, 150) -> (210, 150)
                processor.handleTouchMove([createPointer(160, 100, 160, 100), createPointer(260, 200, 260, 200)]);

                expect(panMock).toHaveBeenCalledWith(60, 0);
            });

            it("does not pan when the pinch midpoint moves in center mode", () => {
                config.updateEventHandlers({ zoom: "center" });

                processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(200, 200, 200, 200)]);
                processor.handleTouchMove([createPointer(160, 100, 160, 100), createPointer(260, 200, 260, 200)]);

                expect(panMock).not.toHaveBeenCalled();
            });

            it("does not blow up the zoom when the pinch starts at (near) zero distance", () => {
                // Both fingers land on the same point: distance 0. Without a
                // guard the next move would divide by zero and snap the zoom
                // to its limit.
                processor.handleTouchStart([createPointer(100, 100, 100, 100), createPointer(100, 100, 100, 100)]);
                processor.handleTouchMove([createPointer(50, 50, 50, 50), createPointer(250, 250, 250, 250)]);

                expect(zoomByFactorMock).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number));
            });
        });

        describe("handleTouchEnd", () => {
            it("ends drag mode when all fingers lifted", () => {
                processor.handleTouchStart([createPointer(100, 100)]);
                processor.handleTouchEnd([], createPointer(100, 100));
                expect(processor.dragging).toBe(false);
            });

            it("switches from pinch to drag when one finger remains", () => {
                processor.handleTouchStart([createPointer(100, 100), createPointer(200, 200)]);
                processor.handleTouchEnd([createPointer(100, 100)]);
                expect(processor.pinching).toBe(false);
                expect(processor.dragging).toBe(true);
            });

            it("fires click on tap (touch without move)", () => {
                const onClick = vi.fn();
                processor.onClick = onClick;

                processor.handleTouchStart([createPointer(100, 100)]);
                processor.handleTouchEnd([], createPointer(100, 100));

                expect(onClick).toHaveBeenCalledTimes(1);
            });

            it("does not fire click after drag", () => {
                const onClick = vi.fn();
                processor.onClick = onClick;

                processor.handleTouchStart([createPointer(100, 100, 100, 100)]);
                processor.handleTouchMove([createPointer(150, 150, 150, 150)]);
                processor.handleTouchEnd([], createPointer(150, 150));

                expect(onClick).not.toHaveBeenCalled();
            });
        });
    });

    describe("state queries", () => {
        it("reports dragging state correctly", () => {
            expect(processor.dragging).toBe(false);
            processor.handlePointerDown(createPointer(100, 100));
            expect(processor.dragging).toBe(true);
            processor.handlePointerUp(createPointer(100, 100));
            expect(processor.dragging).toBe(false);
        });

        it("reports pinching state correctly", () => {
            expect(processor.pinching).toBe(false);
            processor.handleTouchStart([createPointer(100, 100), createPointer(200, 200)]);
            expect(processor.pinching).toBe(true);
            processor.handleTouchEnd([]);
            expect(processor.pinching).toBe(false);
        });
    });

    describe("handleKeyDown", () => {
        /** A processor whose config is exactly the handlers under test. */
        const withHandlers = (eventHandlers: Record<string, unknown>) =>
            new GestureProcessor(
                mockCamera,
                new Config({ scale: 1, size: { width: 800, height: 600 }, eventHandlers }),
                transformer,
                () => canvasBounds,
                onCameraChange,
            );

        it("pans the view in the pressed direction", () => {
            // pan(dx, dy) shifts the camera by -d/scale, so moving the VIEW
            // right is a negative delta.
            processor.handleKeyDown({ key: "ArrowRight" });
            expect(panMock).toHaveBeenLastCalledWith(-80, 0);

            processor.handleKeyDown({ key: "ArrowLeft" });
            expect(panMock).toHaveBeenLastCalledWith(80, 0);

            processor.handleKeyDown({ key: "ArrowDown" });
            expect(panMock).toHaveBeenLastCalledWith(0, -80);

            processor.handleKeyDown({ key: "ArrowUp" });
            expect(panMock).toHaveBeenLastCalledWith(0, 80);
        });

        it("zooms at the viewport center on +/-", () => {
            expect(processor.handleKeyDown({ key: "+" })).toBe(true);
            expect(zoomByFactorMock).toHaveBeenLastCalledWith(1.5, 400, 300);

            processor.handleKeyDown({ key: "-" });
            expect(zoomByFactorMock).toHaveBeenLastCalledWith(1 / 1.5, 400, 300);

            // The unshifted spellings of the same physical keys.
            processor.handleKeyDown({ key: "=" });
            expect(zoomByFactorMock).toHaveBeenLastCalledWith(1.5, 400, 300);
            processor.handleKeyDown({ key: "_" });
            expect(zoomByFactorMock).toHaveBeenLastCalledWith(1 / 1.5, 400, 300);
        });

        it("activates at the viewport center with truthful coordinates", () => {
            const onClick = vi.fn();
            processor.onClick = onClick;
            canvasBounds = { ...canvasBounds, left: 30, top: 40 };

            expect(processor.handleKeyDown({ key: "Enter" })).toBe(true);
            expect(processor.handleKeyDown({ key: " " })).toBe(true);

            expect(onClick).toHaveBeenCalledTimes(2);
            const [, mouse, client, info] = onClick.mock.calls[0];
            expect(mouse.raw).toEqual({ x: 400, y: 300 });
            expect(client.raw).toEqual({ x: 430, y: 340 });
            expect(info).toEqual({ source: "keyboard" });
        });

        it("tags a pointer click as such", () => {
            const onClick = vi.fn();
            processor.onClick = onClick;

            processor.handleClick(createPointer(10, 10));

            expect(onClick.mock.calls[0][3]).toEqual({ source: "pointer" });
        });

        // The frozen no-trap contract.
        it("never consumes the keys that let a user escape", () => {
            for (const key of ["Tab", "Escape", "Home", "End", "PageUp", "PageDown", "a", "F5"]) {
                expect(processor.handleKeyDown({ key })).toBe(false);
            }
            expect(panMock).not.toHaveBeenCalled();
        });

        it("ignores any modifier combination so browser shortcuts keep working", () => {
            for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
                expect(processor.handleKeyDown({ key: "ArrowRight", [modifier]: true })).toBe(false);
            }
            expect(panMock).not.toHaveBeenCalled();
        });

        // The central decision: keyboard grants nothing the app did not grant.
        it("mirrors the pointer gates by default", () => {
            const inert = withHandlers({});
            for (const key of ["ArrowRight", "+", "-", "Enter", " "]) {
                expect(inert.handleKeyDown({ key })).toBe(false);
            }
            expect(panMock).not.toHaveBeenCalled();

            const dragOnly = withHandlers({ drag: true });
            expect(dragOnly.handleKeyDown({ key: "ArrowRight" })).toBe(true);
            expect(dragOnly.handleKeyDown({ key: "+" })).toBe(false);
            expect(dragOnly.handleKeyDown({ key: "Enter" })).toBe(false);

            const zoomOnly = withHandlers({ zoom: true });
            expect(zoomOnly.handleKeyDown({ key: "+" })).toBe(true);
            expect(zoomOnly.handleKeyDown({ key: "ArrowRight" })).toBe(false);
        });

        it("keyboard: true forces every binding on", () => {
            const forced = withHandlers({ keyboard: true });
            forced.onClick = vi.fn();

            expect(forced.handleKeyDown({ key: "ArrowRight" })).toBe(true);
            expect(forced.handleKeyDown({ key: "+" })).toBe(true);
            expect(forced.handleKeyDown({ key: "Enter" })).toBe(true);
        });

        it("keyboard: false turns every binding off", () => {
            const off = withHandlers({ click: true, drag: true, zoom: true, keyboard: false });
            for (const key of ["ArrowRight", "+", "Enter"]) {
                expect(off.handleKeyDown({ key })).toBe(false);
            }
        });

        it("takes the step sizes from the keyboard options, with panPx winning", () => {
            withHandlers({ drag: true, keyboard: { panPx: 25 } }).handleKeyDown({ key: "ArrowRight" });
            expect(panMock).toHaveBeenLastCalledWith(-25, 0);

            // World units convert through the live scale (1 here).
            withHandlers({ drag: true, keyboard: { pan: 3 } }).handleKeyDown({ key: "ArrowRight" });
            expect(panMock).toHaveBeenLastCalledWith(-3, 0);

            withHandlers({ drag: true, keyboard: { pan: 3, panPx: 25 } }).handleKeyDown({ key: "ArrowRight" });
            expect(panMock).toHaveBeenLastCalledWith(-25, 0);

            withHandlers({ zoom: true, keyboard: { zoomFactor: 2 } }).handleKeyDown({ key: "+" });
            expect(zoomByFactorMock).toHaveBeenLastCalledWith(2, 400, 300);
        });

        it("reports keyboard zoom through onZoom, never onWheel", () => {
            const onZoom = vi.fn();
            const onWheel = vi.fn();
            let scale = 1;
            const camera = { ...mockCamera, zoomByFactor: vi.fn(() => (scale = 2)) };
            Object.defineProperty(camera, "scale", { get: () => scale });
            const keyed = new GestureProcessor(camera, config, transformer, () => canvasBounds, onCameraChange);
            keyed.onZoom = onZoom;
            keyed.onWheel = onWheel;

            keyed.handleKeyDown({ key: "+" });

            expect(onZoom).toHaveBeenCalledWith(2);
            expect(onWheel).not.toHaveBeenCalled();
        });
    });
});
