/**
 * Whether `value` is a non-null object that is not an array.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
