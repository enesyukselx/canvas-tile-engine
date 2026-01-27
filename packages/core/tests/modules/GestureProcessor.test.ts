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
                expect.objectContaining({ raw: expect.any(Object) as unknown, snapped: expect.any(Object) as unknown })
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
});
