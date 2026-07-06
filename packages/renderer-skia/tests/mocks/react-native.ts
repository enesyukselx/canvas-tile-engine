/**
 * Minimal mock of `react-native` for node tests (Platform.select only).
 * Wired in via `resolve.alias` in vitest.config.mts.
 */
export const Platform = {
    OS: "android",
    select<T>(spec: { ios?: T; android?: T; default?: T }): T {
        return (spec.android ?? spec.default) as T;
    },
};
