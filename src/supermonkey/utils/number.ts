/**
 * Clamps a finite number to `[min, max]`.
 * Non-finite or non-number inputs return `defaultValue`.
 */
export function boundNumber(value: number, min: number, max: number, defaultValue: number): number {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        return defaultValue;
    }

    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

/**
 * Parses the first run of digits in `value` as a base-10 integer.
 * @returns The integer, or `null` when `value` has no digits
 */
export function parseInteger(value: string): number | null {
    if (typeof value !== "string") {
        return null;
    }
    const digits = value.replace(/\D+/g, "");
    if (digits.length === 0) {
        return null;
    }
    const parsed = Number.parseInt(digits, 10);
    if (!Number.isInteger(parsed) || Number.isNaN(parsed)) {
        return null;
    }
    return parsed;
}
