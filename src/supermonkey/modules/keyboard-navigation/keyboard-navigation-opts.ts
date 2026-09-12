import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { readStringList } from "../../utils/opts/opts-fields";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";

export type KeyboardNavigationOpts = ModuleOpts & {
    readonly previousSelectors: string[];
    readonly nextSelectors: string[];
};

/**
 * Normalizes Keyboard Navigation opts before load.
 * Missing or empty `previousSelectors` / `nextSelectors` omit `value`.
 */
export function normalizeKeyboardNavigationOpts(raw: unknown): Normalized<KeyboardNavigationOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<KeyboardNavigationOpts>(undefined);
    }

    const previousSelectors = readRequiredSelectors(raw.previousSelectors, "previousSelectors", walk);
    const nextSelectors = readRequiredSelectors(raw.nextSelectors, "nextSelectors", walk);

    if (previousSelectors == null || nextSelectors == null) {
        return walk.finish<KeyboardNavigationOpts>(undefined);
    }

    return walk.finish({
        previousSelectors,
        nextSelectors,
    });
}

function readRequiredSelectors(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): string[] | undefined {
    if (raw == null) {
        walk.reject(path, "is required");
        return undefined;
    }

    if (!Array.isArray(raw)) {
        walk.reject(path, "must be a string array");
        return undefined;
    }

    const selectors = readStringList(raw, path, walk, {
        label: "selectors",
        onEmpty: "repair",
    });

    if (selectors == null || selectors.length === 0) {
        walk.reject(path, "must be a non-empty string array");
        return undefined;
    }

    return selectors;
}
