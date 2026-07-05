import { Platform } from "react-native";

/**
 * Platform-correct default font families. "sans-serif" and "monospace" are
 * Android family names; iOS has no such families, so matching would silently
 * fall back to an arbitrary default typeface there.
 * @internal
 */
export const DEFAULT_SANS_SERIF = Platform.select({ ios: "Helvetica", default: "sans-serif" });

/** @internal */
export const DEFAULT_MONOSPACE = Platform.select({ ios: "Menlo", default: "monospace" });
