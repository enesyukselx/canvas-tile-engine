import { CanvasTileEngineConfig } from "../types";

/**
 * Creates a validation error with descriptive message.
 */
function configError(message: string): Error {
    return new Error(`[CanvasTileEngine] Invalid config: ${message}`);
}

/**
 * Validates the engine configuration and throws descriptive errors for invalid values.
 * @param config The configuration to validate.
 * @throws {ConfigValidationError} If any config value is invalid.
 */
export function validateConfig(config: CanvasTileEngineConfig): void {
    // Scale validation
    if (typeof config.scale !== "number" || !Number.isFinite(config.scale)) {
        throw configError(`scale must be a finite number, got ${config.scale}`);
    }
    if (config.scale <= 0) {
        throw configError(`scale must be positive, got ${config.scale}`);
    }

    // Min/Max scale validation
    if (config.minScale !== undefined) {
        if (typeof config.minScale !== "number" || !Number.isFinite(config.minScale)) {
            throw configError(`minScale must be a finite number, got ${config.minScale}`);
        }
        if (config.minScale <= 0) {
            throw configError(`minScale must be positive, got ${config.minScale}`);
        }
    }

    if (config.maxScale !== undefined) {
        if (typeof config.maxScale !== "number" || !Number.isFinite(config.maxScale)) {
            throw configError(`maxScale must be a finite number, got ${config.maxScale}`);
        }
        if (config.maxScale <= 0) {
            throw configError(`maxScale must be positive, got ${config.maxScale}`);
        }
    }

    if (config.minScale !== undefined && config.maxScale !== undefined) {
        if (config.minScale > config.maxScale) {
            throw configError(`minScale (${config.minScale}) cannot be greater than maxScale (${config.maxScale})`);
        }
    }

    // The initial scale must lie within the zoom limits, otherwise the camera
    // starts out of range and snaps on the first zoom interaction.
    if (config.minScale !== undefined && config.scale < config.minScale) {
        throw configError(`scale (${config.scale}) cannot be less than minScale (${config.minScale})`);
    }
    if (config.maxScale !== undefined && config.scale > config.maxScale) {
        throw configError(`scale (${config.scale}) cannot be greater than maxScale (${config.maxScale})`);
    }

    // Size validation
    if (!config.size || typeof config.size !== "object") {
        throw configError("size is required and must be an object");
    }

    if (typeof config.size.width !== "number" || !Number.isFinite(config.size.width)) {
        throw configError(`size.width must be a finite number, got ${config.size.width}`);
    }
    if (config.size.width <= 0) {
        throw configError(`size.width must be positive, got ${config.size.width}`);
    }

    if (typeof config.size.height !== "number" || !Number.isFinite(config.size.height)) {
        throw configError(`size.height must be a finite number, got ${config.size.height}`);
    }
    if (config.size.height <= 0) {
        throw configError(`size.height must be positive, got ${config.size.height}`);
    }

    // Size limits validation. Min limits must be finite; max limits may be
    // Infinity (the documented "no limit" value) but never NaN. Comparison
    // checks alone would let NaN and wrong types through (NaN <= 0 is false).
    const sizeLimits = [
        ["minWidth", config.size.minWidth, true],
        ["maxWidth", config.size.maxWidth, false],
        ["minHeight", config.size.minHeight, true],
        ["maxHeight", config.size.maxHeight, false],
    ] as const;
    for (const [name, value, mustBeFinite] of sizeLimits) {
        if (value === undefined) continue;
        if (typeof value !== "number" || Number.isNaN(value) || (mustBeFinite && !Number.isFinite(value))) {
            throw configError(`size.${name} must be a ${mustBeFinite ? "finite " : ""}number, got ${value}`);
        }
        if (value <= 0) {
            throw configError(`size.${name} must be positive, got ${value}`);
        }
    }

    if (config.size.minWidth !== undefined && config.size.maxWidth !== undefined) {
        if (config.size.minWidth > config.size.maxWidth) {
            throw configError(
                `size.minWidth (${config.size.minWidth}) cannot be greater than size.maxWidth (${config.size.maxWidth})`,
            );
        }
    }

    if (config.size.minHeight !== undefined && config.size.maxHeight !== undefined) {
        if (config.size.minHeight > config.size.maxHeight) {
            throw configError(
                `size.minHeight (${config.size.minHeight}) cannot be greater than size.maxHeight (${config.size.maxHeight})`,
            );
        }
    }

    // Event handler validation
    const zoom = config.eventHandlers?.zoom;
    if (zoom !== undefined && typeof zoom !== "boolean" && zoom !== "pointer" && zoom !== "center") {
        throw configError(`eventHandlers.zoom must be a boolean, "pointer" or "center", got ${zoom}`);
    }

    // Bounds validation
    if (config.bounds) {
        validateBounds(config.bounds);
    }
}

/**
 * Validates bounds object for setBounds method.
 * @param bounds The bounds to validate.
 * @throws {ConfigValidationError} If bounds are invalid.
 */
export function validateBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const { minX, maxX, minY, maxY } = bounds;

    if (typeof minX !== "number" || typeof maxX !== "number") {
        throw configError("bounds.minX and bounds.maxX must be numbers");
    }
    if (typeof minY !== "number" || typeof maxY !== "number") {
        throw configError("bounds.minY and bounds.maxY must be numbers");
    }

    // `!(min < max)` also rejects NaN (every comparison is false) and
    // degenerate infinite pairs like minX: Infinity, while -Infinity/Infinity
    // stay valid for unbounded axes. NaN bounds would otherwise silently
    // poison the camera clamp math and blank the canvas.
    if (!(minX < maxX)) {
        throw configError(`bounds.minX (${minX}) must be less than bounds.maxX (${maxX})`);
    }
    if (!(minY < maxY)) {
        throw configError(`bounds.minY (${minY}) must be less than bounds.maxY (${maxY})`);
    }
}

/**
 * Validates coordinates for goCenter method.
 * @param x X coordinate.
 * @param y Y coordinate.
 * @throws {ConfigValidationError} If coordinates are invalid.
 */
export function validateCoords(x: number, y: number): void {
    if (typeof x !== "number" || !Number.isFinite(x)) {
        throw configError(`x coordinate must be a finite number, got ${x}`);
    }
    if (typeof y !== "number" || !Number.isFinite(y)) {
        throw configError(`y coordinate must be a finite number, got ${y}`);
    }
}

/**
 * Validates arguments for the fitBounds method. Unlike camera bounds
 * (validateBounds), every edge must be finite: an infinite rectangle cannot
 * be fitted into the viewport.
 * @param bounds The rectangle to fit.
 * @param padding World-unit margin added on every side.
 * @param paddingPx Screen-pixel margin kept free on every side.
 * @throws {ConfigValidationError} If bounds or a padding value is invalid.
 */
export function validateFitBounds(
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    padding: number,
    paddingPx?: number,
): void {
    const edges = [
        ["minX", bounds.minX],
        ["maxX", bounds.maxX],
        ["minY", bounds.minY],
        ["maxY", bounds.maxY],
    ] as const;
    for (const [name, value] of edges) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw configError(`fitBounds bounds.${name} must be a finite number, got ${value}`);
        }
    }
    if (bounds.minX >= bounds.maxX) {
        throw configError(`fitBounds bounds.minX (${bounds.minX}) must be less than bounds.maxX (${bounds.maxX})`);
    }
    if (bounds.minY >= bounds.maxY) {
        throw configError(`fitBounds bounds.minY (${bounds.minY}) must be less than bounds.maxY (${bounds.maxY})`);
    }
    if (typeof padding !== "number" || !Number.isFinite(padding) || padding < 0) {
        throw configError(`fitBounds padding must be a non-negative finite number, got ${padding}`);
    }
    if (paddingPx !== undefined && (typeof paddingPx !== "number" || !Number.isFinite(paddingPx) || paddingPx < 0)) {
        throw configError(`fitBounds paddingPx must be a non-negative finite number, got ${paddingPx}`);
    }
}

/**
 * Validates scale value for setScale method.
 * @param scale The scale value to validate.
 * @throws {ConfigValidationError} If scale is invalid.
 */
export function validateScale(scale: number): void {
    if (typeof scale !== "number" || !Number.isFinite(scale)) {
        throw configError(`scale must be a finite number, got ${scale}`);
    }
    if (scale <= 0) {
        throw configError(`scale must be positive, got ${scale}`);
    }
}

/**
 * Validates scale limits for setScaleLimits method.
 * @param minScale Minimum scale.
 * @param maxScale Maximum scale.
 * @throws {ConfigValidationError} If limits are invalid.
 */
export function validateScaleLimits(minScale: number, maxScale: number): void {
    if (typeof minScale !== "number" || !Number.isFinite(minScale)) {
        throw configError(`minScale must be a finite number, got ${minScale}`);
    }
    if (minScale <= 0) {
        throw configError(`minScale must be positive, got ${minScale}`);
    }
    if (typeof maxScale !== "number" || !Number.isFinite(maxScale)) {
        throw configError(`maxScale must be a finite number, got ${maxScale}`);
    }
    if (maxScale <= 0) {
        throw configError(`maxScale must be positive, got ${maxScale}`);
    }
    if (minScale > maxScale) {
        throw configError(`minScale (${minScale}) cannot be greater than maxScale (${maxScale})`);
    }
}
