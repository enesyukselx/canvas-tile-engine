# Selection tools (core >= 0.12)

Use `SelectionController` for single/modified selection, box selection, group translation and grid snap. Import it, `createItemCollectionSelectionAdapter`, `translateItem`, and their types from core, React, or React Native. Keep the ItemCollection stable; register it once, then bind its returned handle:

```ts
const handle = engine.drawRect(items, 1, { id: "editable" });
const selection = new SelectionController(engine, {
    adapter: createItemCollectionSelectionAdapter(items, { handle }),
    grid: 1,
    selectable: (item) => item.selectable !== false,
    locked: (item) => item.locked === true,
});
engine.setTool(selection);
engine.render();
```

- Explicitly activate with `setTool`; construction alone does not intercept input. `setTool(null)` returns the next press to the configured camera gestures. Never replace the app's onClick/onHover callbacks or temporarily rewrite drag flags to implement a tool.
- Use readonly `selectedIds`, `setSelection(iterable)`, `clearSelection()`, `translateSelection({x,y})`, `cancel()`, `dispose()`. Missing/unselectable IDs are filtered. Locked items remain selectable but never translate. The helper checks handle identity as well as key, so equal keys in unrelated draws do not collide. Replacing a draw registration requires a new helper/controller for the new handle.
- Click selects one; pressing a selected member preserves a group for dragging, then an unmoved release selects just that member. Shift adds; Ctrl/Meta toggles. Empty drag creates a marquee; Shift unions, Ctrl/Meta toggles against the press-time selection. Default `marqueeMode` is `intersect`, optional `contain`; drag threshold is 4 screen pixels.
- `grid: number | {x,y,origin?}` uses positive world steps. Snap the picked anchor, preserving group offsets. Anchored items use x/y, lines use from, paths use the first point/non-close command endpoint. Override `anchor`/`translate` in the helper if the model needs another rule. Programmatic `translateSelection` does not grid-snap.
- `translateItem` returns immutable geometry for every dynamic primitive: anchor positions, both line endpoints, path points and every command/control point/arc center. Preserve data/style and arc angles/radii. Text can move programmatically but still has no engine hit testing.
- `getSnapshot()` is stable until a change and returns `{selectedIds,phase,marquee}`. `subscribe(listener)` returns cleanup; state changes automatically requestRender, including styleOf selection decorations. Use useSyncExternalStore for React UI. Paint overlays yourself; no draw handles are added by the controller.
- Marquee bounds are **raw/corner world space** for hitTestRect. Subtract 0.5 before passing corners to DrawTransform.worldToScreen for an overlay. Do not use itemsBounds as precise painted transform bounds: it omits origin/rotation/fixed-pixel effects.
- In React/native effects, depend on engine.instance and dispose the controller/remove the draw handle on cleanup. The engine handle forwards setTool/getTool/subscribeInput/subscribeToolChange; pre-mount calls are no-ops. Native imports use the same API and claim touches against ScrollView while a tool is active. Native provides contact ID/type, but no synthetic hardware keyboard/modifier input; use toolbar selection for additive touch workflows.
- Keep zoom enabled for wheel/pinch. A second touch cancels object preview before pinch. Tool capture prevents camera pan through outside release, tool switching, and cancellation. Escape cancels an active browser edit; set accessibility.label and, for tool-only surfaces with all event flags off, accessibility.focusable:true.
- Pair onTransformStart({kind:"translate",ids}) and onTransformEnd({... ,cancelled}) to integrate history; they run once per actual edit, never for simple clicks/locked-only/zero moves. Cancellation restores only the controller's own previews. Before the first preview, external updates are followed (the press continues); after it, external replacements/deletions abort safely; a broader history transaction still needs its own policy for external changes.
- `subscribeInput((event,handled)=>...)` is additive. Types are pointerdown/move/up/leave/cancel and keydown; pointer events include coords/mouse/client and pointer metadata. One EngineTool implements handleInput(event), optionally cancel/dispose. Return true on pointerdown to own the whole press; a tool's true for Tab is ignored (focus must stay escapable); subscribeToolChange tracks activation. Custom renderers pass deps.input to GestureProcessor and forward real cancellation/captured outside moves.
- Resize/rotate handles, lasso, alignment guides, exact painted bounds and edge auto-pan are future scope. Do not invent those APIs.
