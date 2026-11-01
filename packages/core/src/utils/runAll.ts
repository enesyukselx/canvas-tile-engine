/** Complete independent notifications/cleanup, then rethrow the first failure. @internal */
export function runAll(callbacks: Iterable<() => void>): void {
    let failed = false;
    let firstError: unknown;
    for (const callback of callbacks) {
        try {
            callback();
        } catch (error) {
            if (!failed) {
                failed = true;
                firstError = error;
            }
        }
    }
    if (failed) {
        throw firstError;
    }
}
