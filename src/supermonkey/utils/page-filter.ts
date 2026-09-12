import { trimArray } from "./arrays";
import { splitAllowDenyPatterns } from "./allow-deny";

/**
 * Whether an allow/deny name list permits the given active names.
 *
 * - `null` / `undefined` / `[]` / only empty strings → allowed (filter ignored).
 * - Positives (`"home"`) → at least one must be active.
 * - Negatives (`"!!home"`) → none may be active.
 * - Negatives only → allowed for any active set except the negated names.
 */
export function passesPageFilter(
    pageFilter: readonly string[] | null | undefined,
    activeNames: readonly string[],
): boolean {
    if (pageFilter == null || pageFilter.length === 0) {
        return true;
    }

    const { positives, negatives } = splitAllowDenyPatterns(trimArray(pageFilter));
    if (positives.length === 0 && negatives.length === 0) {
        return true;
    }

    const active = new Set(activeNames);

    if (negatives.some((name) => active.has(name))) {
        return false;
    }

    if (positives.length === 0) {
        return true;
    }

    return positives.some((name) => active.has(name));
}
