/** Roots accepted by DOM query helpers (`HTMLElement`, `Document`, or `ShadowRoot`). */
export type QueryableBaseElement = HTMLElement | Document | ShadowRoot;

/**
 * Returns the first element matching any of `selectors` under `baseElement`.
 * When `baseElement` is an array, tries each root in order.
 */
export function query<T extends HTMLElement>(
    selectors: string | string[],
    baseElement?: QueryableBaseElement | QueryableBaseElement[],
): T | null {
    if (Array.isArray(baseElement)) {
        for (const element of baseElement) {
            const found = query<T>(selectors, element);
            if (found) {
                return found;
            }
        }
        return null;
    }

    const selectorList = normalizeSelectors(selectors);
    if (selectorList.length === 0) {
        return null;
    }

    const root = baseElement ?? document;
    for (const selector of selectorList) {
        try {
            const found = root.querySelector<T>(selector);
            if (found) {
                return found;
            }
        } catch {
            // Invalid selector-skip
        }
    }
    return null;
}

/**
 * Returns every element matching any of `selectors` under `baseElement`.
 * When `baseElement` is an array, searches each root and concatenates results.
 */
export function queryAll<T extends HTMLElement>(
    selectors: string | string[],
    baseElement?: QueryableBaseElement | QueryableBaseElement[],
): T[] {
    if (Array.isArray(baseElement)) {
        return baseElement.flatMap((element) => queryAll<T>(selectors, element));
    }

    const selectorList = normalizeSelectors(selectors);
    if (selectorList.length === 0) {
        return [];
    }

    const root = baseElement ?? document;
    return selectorList.flatMap((selector) => {
        try {
            return Array.from(root.querySelectorAll<T>(selector));
        } catch {
            return [];
        }
    });
}

function normalizeSelectors(selectors: string | string[]): string[] {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    return list.filter((selector) => typeof selector === "string" && selector.trim().length > 0);
}
