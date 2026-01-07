import { describe, expect, it } from "vitest";
import { applyLineWidth } from "../../src/utils/canvas";

describe("applyLineWidth", () => {
    const createMockContext = () => ({
        lineWidth: 0,
        globalAlpha: 1,
    });

    it("sets lineWidth directly when >= 1", () => {
        const ctx = createMockContext() as unknown as CanvasRenderingContext2D;
        const cleanup = applyLineWidth(ctx, 2);

        expect(ctx.lineWidth).toBe(2);
        expect(ctx.globalAlpha).toBe(1);

        cleanup();
        expect(ctx.globalAlpha).toBe(1);
    });

    it("sets lineWidth to 1 when exactly 1", () => {
        const ctx = createMockContext() as unknown as CanvasRenderingContext2D;
        applyLineWidth(ctx, 1);

        expect(ctx.lineWidth).toBe(1);
        expect(ctx.globalAlpha).toBe(1);
    });

    it("uses globalAlpha for lineWidth < 1", () => {
        const ctx = createMockContext() as unknown as CanvasRenderingContext2D;
        const cleanup = applyLineWidth(ctx, 0.5);

        expect(ctx.lineWidth).toBe(1);
        expect(ctx.globalAlpha).toBe(0.5);

        cleanup();
        expect(ctx.globalAlpha).toBe(1);
    });

    it("clamps alpha to minimum 0", () => {
        const ctx = createMockContext() as unknown as CanvasRenderingContext2D;
        applyLineWidth(ctx, -0.5);

        expect(ctx.lineWidth).toBe(1);
        expect(ctx.globalAlpha).toBe(0);
    });

    it("clamps alpha to maximum 1 for values between 0 and 1", () => {
        const ctx = createMockContext() as unknown as CanvasRenderingContext2D;
        applyLineWidth(ctx, 0.99);

        expect(ctx.lineWidth).toBe(1);
        expect(ctx.globalAlpha).toBe(0.99);
    });

    it("returns no-op cleanup for lineWidth >= 1", () => {
        const ctx = createMockContext() as unknown as CanvasRenderingContext2D;
        ctx.globalAlpha = 0.5;

        const cleanup = applyLineWidth(ctx, 3);
        cleanup();

        expect(ctx.globalAlpha).toBe(0.5);
    });
});
