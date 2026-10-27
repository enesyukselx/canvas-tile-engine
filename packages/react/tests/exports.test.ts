import { describe, expectTypeOf, it } from "vitest";
import type * as Core from "@canvas-tile-engine/core";
import type * as Binding from "../src";

// Type-level contract for the core types the binding re-exports, so app code
// never needs a second import from core just to name one. `tsc --noEmit`
// (the package's `typecheck`, which includes `tests/`) is what enforces it: a
// type missing from the binding's root index fails to resolve, and a
// re-export of the wrong type fails `toEqualTypeOf`. Under `vitest run` the
// assertions are no-ops.

type Data = { id: string };

describe("core type re-exports", () => {
    it("re-exports the config types", () => {
        expectTypeOf<Binding.ZoomMode>().toEqualTypeOf<Core.ZoomMode>();
        expectTypeOf<Binding.KeyboardConfig>().toEqualTypeOf<Core.KeyboardConfig>();
        expectTypeOf<Binding.AccessibilityConfig>().toEqualTypeOf<Core.AccessibilityConfig>();
        expectTypeOf<Binding.AccessibilityRole>().toEqualTypeOf<Core.AccessibilityRole>();
        expectTypeOf<Binding.ReducedMotionSetting>().toEqualTypeOf<Core.ReducedMotionSetting>();
    });

    it("re-exports the geometry and camera types", () => {
        expectTypeOf<Binding.Bounds>().toEqualTypeOf<Core.Bounds>();
        expectTypeOf<Binding.FitBoundsOptions>().toEqualTypeOf<Core.FitBoundsOptions>();
        expectTypeOf<Binding.DrawTransform>().toEqualTypeOf<Core.DrawTransform>();
    });

    it("re-exports the paint and text style types", () => {
        expectTypeOf<Binding.Paint>().toEqualTypeOf<Core.Paint>();
        expectTypeOf<Binding.LinearGradient>().toEqualTypeOf<Core.LinearGradient>();
        expectTypeOf<Binding.ColorStop>().toEqualTypeOf<Core.ColorStop>();
        expectTypeOf<Binding.TextAlign>().toEqualTypeOf<Core.TextAlign>();
        expectTypeOf<Binding.TextBaseline>().toEqualTypeOf<Core.TextBaseline>();
        expectTypeOf<Binding.FontWeight>().toEqualTypeOf<Core.FontWeight>();
    });

    it("re-exports the draw option and paint-time callback types", () => {
        expectTypeOf<Binding.DrawOptions>().toEqualTypeOf<Core.DrawOptions>();
        expectTypeOf<Binding.StaticDrawOptions>().toEqualTypeOf<Core.StaticDrawOptions>();
        expectTypeOf<Binding.RectDrawOptions<Data>>().toEqualTypeOf<Core.RectDrawOptions<Data>>();
        expectTypeOf<Binding.CircleDrawOptions<Data>>().toEqualTypeOf<Core.CircleDrawOptions<Data>>();
        expectTypeOf<Binding.TextDrawOptions<Data>>().toEqualTypeOf<Core.TextDrawOptions<Data>>();
        expectTypeOf<Binding.LineDrawOptions<Data>>().toEqualTypeOf<Core.LineDrawOptions<Data>>();
        expectTypeOf<Binding.PathDrawOptions<Data>>().toEqualTypeOf<Core.PathDrawOptions<Data>>();
        expectTypeOf<Binding.ImageDrawOptions<HTMLImageElement, Data>>().toEqualTypeOf<
            Core.ImageDrawOptions<HTMLImageElement, Data>
        >();
        expectTypeOf<Binding.StyleOf<Core.Rect<Data>, Core.ShapeDecorationStyle>>().toEqualTypeOf<
            Core.StyleOf<Core.Rect<Data>, Core.ShapeDecorationStyle>
        >();
        expectTypeOf<Binding.VisibleOf<Core.Rect<Data>>>().toEqualTypeOf<Core.VisibleOf<Core.Rect<Data>>>();
        expectTypeOf<Binding.InteractiveOf<Core.Rect<Data>>>().toEqualTypeOf<Core.InteractiveOf<Core.Rect<Data>>>();
        expectTypeOf<Binding.ShapeDecorationStyle>().toEqualTypeOf<Core.ShapeDecorationStyle>();
        expectTypeOf<Binding.TextDecorationStyle>().toEqualTypeOf<Core.TextDecorationStyle>();
        expectTypeOf<Binding.LineDecorationStyle>().toEqualTypeOf<Core.LineDecorationStyle>();
        expectTypeOf<Binding.PathDecorationStyle>().toEqualTypeOf<Core.PathDecorationStyle>();
    });

    it("re-exports the hit-test types", () => {
        expectTypeOf<Binding.HitResult<HTMLImageElement, Data>>().toEqualTypeOf<
            Core.HitResult<HTMLImageElement, Data>
        >();
        expectTypeOf<Binding.HitKind>().toEqualTypeOf<Core.HitKind>();
        expectTypeOf<Binding.HitTestOptions>().toEqualTypeOf<Core.HitTestOptions>();
        expectTypeOf<Binding.HitTestRectOptions>().toEqualTypeOf<Core.HitTestRectOptions>();
    });

    it("re-exports the callback types", () => {
        expectTypeOf<Binding.ClickInfo>().toEqualTypeOf<Core.ClickInfo>();
    });

    it("types the handle's hit-test results with the re-exported HitResult", () => {
        expectTypeOf<ReturnType<Binding.EngineHandle["hitTestFirst"]>>().toEqualTypeOf<
            Binding.HitResult<HTMLImageElement> | undefined
        >();
    });
});
