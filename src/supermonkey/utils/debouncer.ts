const debouncerIds: Record<string, number> = {};

/**
 * Delay for {@link debounce}: a fixed non-negative ms value, or a random inclusive `[min, max]` range.
 */
export type DebouncerTimeoutRange = number | { min: number; max: number };

function resolveTimeout(timeout: DebouncerTimeoutRange): number {
    if (typeof timeout === "number") {
        if (timeout < 0) {
            throw new Error("Debouncer timeout must be a non-negative number");
        }
        return timeout;
    }

    if (
        timeout == null
        || timeout.min == null
        || timeout.max == null
        || timeout.min < 0
        || timeout.max < timeout.min
    ) {
        throw new Error("Debouncer timeout range is invalid");
    }

    return Math.floor(
        Math.random() * (timeout.max - timeout.min) + timeout.min
    );
}

/**
 * Schedules `callback` after `timeout`, replacing any pending call with the same `id`.
 * @throws When `timeout` is negative or an invalid `{ min, max }` range
 */
export function debounce(
    id: string,
    callback: () => void,
    timeout: DebouncerTimeoutRange
): void {
    window.clearTimeout(debouncerIds[id]);

    debouncerIds[id] = window.setTimeout(() => {
        try {
            callback();
        } finally {
            delete debouncerIds[id];
        }
    }, resolveTimeout(timeout));
}
