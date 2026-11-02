import { describe, expectTypeOf, it } from "vitest";
import type * as Core from "@canvas-tile-engine/core";
import type * as Binding from "../dist/index";

describe("published scene document re-exports", () => {
    it("keeps codecs, prepared collections and asset generics identical to core", () => {
        expectTypeOf<typeof Binding.createSceneDocument>().toEqualTypeOf<typeof Core.createSceneDocument>();
        expectTypeOf<typeof Binding.validateSceneDocument>().toEqualTypeOf<typeof Core.validateSceneDocument>();
        expectTypeOf<typeof Binding.parseSceneDocument>().toEqualTypeOf<typeof Core.parseSceneDocument>();
        expectTypeOf<typeof Binding.stringifySceneDocument>().toEqualTypeOf<typeof Core.stringifySceneDocument>();
        expectTypeOf<typeof Binding.prepareScene>().toEqualTypeOf<typeof Core.prepareScene>();
        expectTypeOf<Binding.SceneDocument>().toEqualTypeOf<Core.SceneDocument>();
        expectTypeOf<Binding.SceneCollection<{ image: true }, "image">>().toEqualTypeOf<
            Core.SceneCollection<{ image: true }, "image">
        >();
        expectTypeOf<Binding.PreparedScene<{ image: true }>>().toEqualTypeOf<Core.PreparedScene<{ image: true }>>();
        expectTypeOf<Binding.SceneAttachment>().toEqualTypeOf<Core.SceneAttachment>();
        expectTypeOf<Binding.SceneMigration>().toEqualTypeOf<Core.SceneMigration>();
    });

    it("publishes no PreparedScene constructor, so prepareScene stays the only entry", () => {
        type Constructible<C> = C extends new (...args: never[]) => unknown ? true : false;
        expectTypeOf<Constructible<typeof Binding.PreparedScene>>().toEqualTypeOf<false>();
    });
});
