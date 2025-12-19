---
sidebar_position: 4
---

# Performance

The engine is optimized to handle **large datasets** without lag. This page explains the internal optimizations that make this possible.

## Automatic Optimizations

These optimizations happen automatically—you don't need to configure anything.

### Viewport Culling

Only items within the visible viewport (plus a small buffer) are drawn. Items outside the view are skipped entirely.

```
┌─────────────────────────────────────┐
│           World (1M items)          │
│                                     │
│    ┌───────────────┐                │
│    │   Viewport    │ ← Only these   │
│    │  (500 items)  │   are rendered │
│    └───────────────┘                │
│                                     │
└─────────────────────────────────────┘
```

### Spatial Indexing (R-Tree)

For large datasets (500+ items), the engine uses [RBush](https://github.com/mourner/rbush), an extremely fast R-Tree spatial index.

**Without R-Tree:** To find visible items, every single item must be checked → O(n)

**With R-Tree:** Only items in the viewport region are queried → O(log n)

The R-Tree is built automatically when you call `drawRect`, `drawCircle`, or `drawImage` with an array of items.

### Style Batching

When multiple items share the same style, the engine batches them to reduce canvas state changes:

```typescript
// These are batched internally (single fillStyle set)
engine.drawRect(
    [
        { x: 0, y: 0, style: { fillStyle: "#ff0000" } },
        { x: 1, y: 0, style: { fillStyle: "#ff0000" } },
        { x: 2, y: 0, style: { fillStyle: "#ff0000" } },
    ],
    1
);
```

## Manual Optimizations

For specific use cases, you can enable additional optimizations.

### Static Caching

For scenarios where **all items are visible at once**, use static caching to pre-render content to an offscreen canvas.

```typescript
// Pre-render items once
engine.drawStaticRect(items, "cache-key", 1);
```

See [Drawing & Layers → Static Caching](/docs/js/drawing_and_layers#static-caching-pre-rendered-content) for details.

## Performance Tips

### Do

-   **Use arrays** for batch rendering instead of calling `drawRect` in a loop
-   **Use static caching** when all items need to be visible with dragging enabled
-   **Reuse style objects** when possible to help style batching

```typescript
// Good - single call with array
engine.drawRect(items, 1);
```

### Avoid

-   **Calling draw methods in a loop** - use arrays instead
-   **Creating new style objects per item** when they're identical

```typescript
// Bad - 1000 separate calls
for (const item of items) {
    engine.drawRect(item, 1);
}
```
