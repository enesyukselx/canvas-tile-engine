# Selection tools example

A Canvas2D editor with one `ItemCollection`, a `SelectionController`, and a small
inspector. Tiles keep stable IDs while selection changes and group moves update
the existing draw registration.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter vanilla-js-selection dev
```

Click a tile to select it. Shift-click adds, and Ctrl-click or Cmd-click toggles.
Drag empty space for a rectangular selection. Drag a selected tile to move the
group; the picked tile snaps to the one-unit grid while the other tiles retain
their relative positions. Escape cancels an active gesture.

The amber tile can be selected but stays locked. The gray decoration cannot be
selected. Switch to Pan to move the camera, or scroll to zoom. Selection outlines
use `styleOf`; the marquee reads `getSnapshot()` and paints in a custom draw
callback. The inspector subscribes to selection state and collection updates.

`onTransformStart` and `onTransformEnd` delimit a whole move, including cancellation,
so an application can group its edit history around a gesture. This example does
not include an undo/redo store.
