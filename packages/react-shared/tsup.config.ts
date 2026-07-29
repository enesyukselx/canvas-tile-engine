import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    // Types-only build: consumers bundle the JS from this package's TypeScript
    // source (tsup noExternal), but their bundled d.ts can only inline types
    // resolved from a declaration file. Emitting one flat dist/index.d.ts —
    // no relative imports — is what makes that resolution work.
    dts: { only: true },
    clean: true,
});
