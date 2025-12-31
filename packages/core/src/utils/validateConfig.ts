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
            throw configError(
                `minScale (${config.minScale}) cannot be greater than maxScale (${config.maxScale})`
            );
        }
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

    // Size limits validation
    if (config.size.minWidth !== undefined && config.size.minWidth <= 0) {
        throw configError(`size.minWidth must be positive, got ${config.size.minWidth}`);
    }
    if (config.size.maxWidth !== undefined && config.size.maxWidth <= 0) {
        throw configError(`size.maxWidth must be positive, got ${config.size.maxWidth}`);
    }
    if (config.size.minHeight !== undefined && config.size.minHeight <= 0) {
        throw configError(`size.minHeight must be positive, got ${config.size.minHeight}`);
    }
    if (config.size.maxHeight !== undefined && config.size.maxHeight <= 0) {
        throw configError(`size.maxHeight must be positive, got ${config.size.maxHeight}`);
    }

    if (config.size.minWidth !== undefined && config.size.maxWidth !== undefined) {
        if (config.size.minWidth > config.size.maxWidth) {
            throw configError(
                `size.minWidth (${config.size.minWidth}) cannot be greater than size.maxWidth (${config.size.maxWidth})`
            );
        }
    }

    if (config.size.minHeight !== undefined && config.size.maxHeight !== undefined) {
        if (config.size.minHeight > config.size.maxHeight) {
            throw configError(
                `size.minHeight (${config.size.minHeight}) cannot be greater than size.maxHeight (${config.size.maxHeight})`
            );
        }
    }

    // Bounds validation
    if (config.bounds) {
        const { minX, maxX, minY, maxY } = config.bounds;

        if (typeof minX !== "number" || typeof maxX !== "number") {
            throw configError("bounds.minX and bounds.maxX must be numbers");
        }
        if (typeof minY !== "number" || typeof maxY !== "number") {
            throw configError("bounds.minY and bounds.maxY must be numbers");
        }

        // Allow Infinity for unbounded axes, but check finite bounds
        if (Number.isFinite(minX) && Number.isFinite(maxX) && minX >= maxX) {
            throw configError(`bounds.minX (${minX}) must be less than bounds.maxX (${maxX})`);
        }
        if (Number.isFinite(minY) && Number.isFinite(maxY) && minY >= maxY) {
            throw configError(`bounds.minY (${minY}) must be less than bounds.maxY (${maxY})`);
        }
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

    if (Number.isFinite(minX) && Number.isFinite(maxX) && minX >= maxX) {
        throw configError(`bounds.minX (${minX}) must be less than bounds.maxX (${maxX})`);
    }
    if (Number.isFinite(minY) && Number.isFinite(maxY) && minY >= maxY) {
        throw configError(`bounds.minY (${minY}) must be less than bounds.maxY (${maxY})`);
    }
}

/**
 * Validates coordinates for goCoords method.
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
