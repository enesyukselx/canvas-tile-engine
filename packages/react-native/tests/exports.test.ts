import { describe, expectTypeOf, it } from "vitest";
import type * as Core from "@canvas-tile-engine/core";
// The PUBLISHED declarations, not ../src: a tsup dts-bundling regression
// (the react-shared flat-dts setup) would drop names from dist only.
import type * as Binding from "../dist/index";

// Type-level contract for the core types the binding re-exports, so app code
// never needs a second import from core just to name one. `tsc --noEmit`
// (the package's `typecheck`, which includes `tests/` and runs after the
// package's own build) is what enforces it: a type missing from the built
// `dist/index.d.ts` fails to resolve, and a
// re-export of the wrong type fails `toEqualTypeOf`. Under `vitest run` the
// assertions are no-ops. Same list as @canvas-tile-engine/react.

type Data = { id: string };

describe("core type re-exports", () => {
    it("re-exports the live collection API", () => {
        expectTypeOf<typeof Binding.ItemCollection>().toEqualTypeOf<typeof Core.ItemCollection>();
        expectTypeOf<typeof Binding.isItemCollection>().toEqualTypeOf<typeof Core.isItemCollection>();
        expectTypeOf<Binding.ItemKey>().toEqualTypeOf<Core.ItemKey>();
        expectTypeOf<Binding.ItemCollectionOptions<Core.Rect<Data>>>().toEqualTypeOf<
            Core.ItemCollectionOptions<Core.Rect<Data>>
        >();
        expectTypeOf<Binding.ItemCollectionChange<Core.Rect<Data>>>().toEqualTypeOf<
            Core.ItemCollectionChange<Core.Rect<Data>>
        >();
        expectTypeOf<Binding.ReadonlyItemCollection<Core.Rect<Data>>>().toEqualTypeOf<
            Core.ReadonlyItemCollection<Core.Rect<Data>>
        >();
        expectTypeOf<Binding.DrawItems<Core.Rect<Data>>>().toEqualTypeOf<Core.DrawItems<Core.Rect<Data>>>();
    });

    it("accepts typed collections through all dynamic draw props and the imperative handle", () => {
        expectTypeOf<Core.ItemCollection<Core.Rect<Data>>>().toMatchTypeOf<Binding.RectProps["items"]>();
        expectTypeOf<Core.ItemCollection<Core.Circle<Data>>>().toMatchTypeOf<Binding.CircleProps["items"]>();
        expectTypeOf<Core.ItemCollection<Core.Line<Data>>>().toMatchTypeOf<Binding.LineProps["items"]>();
        expectTypeOf<Core.ItemCollection<Core.PathItem<Data>>>().toMatchTypeOf<Binding.PathProps["items"]>();
        expectTypeOf<Core.ItemCollection<Core.Text<Data>>>().toMatchTypeOf<Binding.TextProps["items"]>();
        expectTypeOf<Core.ItemCollection<Core.ImageItem<Binding.SkImage, Data>>>().toMatchTypeOf<
            Binding.ImageProps["items"]
        >();
        expectTypeOf<Core.ItemCollection<Core.Rect<Data>>>().toMatchTypeOf<
            Parameters<Binding.EngineHandle["drawRect"]>[0]
        >();
        expectTypeOf<Core.ItemCollection<Core.ImageItem<Binding.SkImage, Data>>>().toMatchTypeOf<
            Parameters<Binding.EngineHandle["drawImage"]>[0]
        >();
    });

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
        expectTypeOf<Binding.ImageDrawOptions<Binding.SkImage, Data>>().toEqualTypeOf<
            Core.ImageDrawOptions<Binding.SkImage, Data>
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
        expectTypeOf<Binding.HitResult<Binding.SkImage, Data>>().toEqualTypeOf<Core.HitResult<Binding.SkImage, Data>>();
        expectTypeOf<Binding.HitKind>().toEqualTypeOf<Core.HitKind>();
        expectTypeOf<Binding.HitTestOptions>().toEqualTypeOf<Core.HitTestOptions>();
        expectTypeOf<Binding.HitTestRectOptions>().toEqualTypeOf<Core.HitTestRectOptions>();
    });

    it("re-exports the callback types", () => {
        expectTypeOf<Binding.ClickInfo>().toEqualTypeOf<Core.ClickInfo>();
    });

    it("re-exports the history values and types", () => {
        expectTypeOf<typeof Binding.History>().toEqualTypeOf<typeof Core.History>();
        expectTypeOf<typeof Binding.HistoryCommittedError>().toEqualTypeOf<typeof Core.HistoryCommittedError>();
        expectTypeOf<typeof Binding.HistoryReplayError>().toEqualTypeOf<typeof Core.HistoryReplayError>();
        expectTypeOf<typeof Binding.createItemCollectionHistory>().toEqualTypeOf<
            typeof Core.createItemCollectionHistory
        >();
        expectTypeOf<typeof Binding.attachItemCollectionHistory>().toEqualTypeOf<
            typeof Core.attachItemCollectionHistory
        >();
        expectTypeOf<typeof Binding.itemCollectionHistoryAdapter>().toEqualTypeOf<
            typeof Core.itemCollectionHistoryAdapter
        >();
        expectTypeOf<Binding.HistoryAdapter<Data>>().toEqualTypeOf<Core.HistoryAdapter<Data>>();
        expectTypeOf<Binding.HistoryDirection>().toEqualTypeOf<Core.HistoryDirection>();
        expectTypeOf<Binding.HistoryOptions<Data>>().toEqualTypeOf<Core.HistoryOptions<Data>>();
        expectTypeOf<Binding.HistoryState>().toEqualTypeOf<Core.HistoryState>();
        expectTypeOf<Binding.ItemCollectionHistoryCommand>().toEqualTypeOf<Core.ItemCollectionHistoryCommand>();
        expectTypeOf<Binding.ItemCollectionHistoryOptions>().toEqualTypeOf<Core.ItemCollectionHistoryOptions>();
    });

    it("types the handle's hit-test results with the re-exported HitResult", () => {
        expectTypeOf<ReturnType<Binding.EngineHandle["hitTestFirst"]>>().toEqualTypeOf<
            Binding.HitResult<Binding.SkImage> | undefined
        >();
    });
});
