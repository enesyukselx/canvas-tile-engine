import { describe, expect, it } from "vitest";
import { ConfigValidationError as CoreConfigValidationError } from "@canvas-tile-engine/core";
import { ConfigValidationError } from "../src";

describe("core re-exports", () => {
    it("re-exports core's ConfigValidationError class itself, so instanceof agrees", () => {
        expect(ConfigValidationError).toBeTypeOf("function");
        expect(ConfigValidationError).toBe(CoreConfigValidationError);
    });
});
