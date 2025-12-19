---
sidebar_position: 5
---

# Coordinate Overlay

The engine includes a built-in coordinate overlay system that displays X and Y axes along the edges of the viewport. This is useful for debugging or for applications where grid position awareness is critical (e.g., map editors, strategy games).

## Enabling the Overlay

The coordinate overlay is part of the `coordinates` configuration object.

```typescript
const config = {
    // ...
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 10, max: 100 },
    },
};
```

## Configuration Options

| Property          | Type           | Default     | Description                                                                                                                         |
| :---------------- | :------------- | :---------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`         | `boolean`      | `false`     | Toggles the overlay visibility.                                                                                                     |
| `shownScaleRange` | `{ min, max }` | `undefined` | Defines the zoom levels (scale) at which the overlay is visible. If the current scale is outside this range, the overlay is hidden. |

### Scale Range Example

You might want to show coordinates only when the user is zoomed in close enough to see individual cells, but hide them when zoomed out to a "world map" view to avoid clutter.

```typescript
coordinates: {
    enabled: true,
    // Only show coordinates when scale is between 20px and 100px per cell
    shownScaleRange: { min: 20, max: 100 }
}
```

## Visual Style

The overlay renders:

-   **Left Axis**: Displays Y coordinates.
-   **Bottom Axis**: Displays X coordinates.
-   **Borders**: Semi-transparent black bars along the left and bottom edges.
-   **Labels**: White text centered on the grid lines.

:::note
The font size of the coordinate labels scales dynamically with the zoom level to remain readable, clamped between a minimum and maximum size.
:::
