# React Native — Responsive Game Map (Skia)

The React Native port of [`examples/react/responsive-game-map`](../../react/responsive-game-map), rendered with `@canvas-tile-engine/react-native` (Skia).

The `App.tsx` is intentionally almost identical to the web version — same `useCanvasTileEngine` hook and the same `<CanvasTileEngine.Image / .Circle / .Rect / .GridLines / .DrawFunction>` compound components. The only differences:

- `renderer={new RendererSkia()}` instead of `RendererCanvas`
- `style` is a `ViewStyle`, not CSS/`className`
- images are `SkImage` (loaded from bundled assets via `expo-asset` + `engine.loadImage(uri)`)
- the `DrawFunction` marker draws with an `SkCanvas` instead of a 2D context

## Requirements

`@shopify/react-native-skia` needs the New Architecture and native code, so this runs on an **Expo dev build** (not Expo Go) or on **web**.

## Run

Metro doesn't fully support pnpm's default isolated `node_modules`, so before installing, add a hoisted linker setting **at the repo root**:

```bash
# from the repo root
echo "node-linker=hoisted" >> .npmrc
pnpm install
```

> This is not committed by default — it's opt-in, scoped to your local checkout, so the rest of the monorepo (and published packages) keeps pnpm's stricter isolated linking. Only add it if you're going to run this example.

```bash
cd examples/react-native/responsive-game-map

# Native (creates a dev build):
pnpm prebuild        # expo prebuild
pnpm ios             # or: pnpm android

# Web (Skia via CanvasKit/WASM):
pnpm web
```

> pnpm + Metro: `metro.config.js` is already set up to watch the workspace root and resolve the hoisted dependencies. If Metro fails to resolve a workspace package, make sure `node-linker=hoisted` is set in the root `.npmrc` and run `pnpm install` again from the repo root.

## Gestures

- one finger drag → pan
- two fingers → pinch zoom
- tap → select a village (opens the modal); when zoomed out past the mini-map threshold, tap recenters and zooms in
