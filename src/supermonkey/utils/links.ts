import { getFirstElementAttributeValue } from "./dom/elements";
import { tryNormalizeUrl } from "./urls";
import { resolveValue, type ValueSource } from "./value-resolver";

/**
 * Known image srcset attributes.
 * This maps to the `attributes` property of the `srcset` value source.
 */
export const KNOWN_IMG_SRCSET_ATTRIBUTES = ["data-lazy-srcset", "data-srcset", "srcset"];

/**
 * Known image src attributes.
 * This maps to the `attributes` property of an `attribute` value source.
 */
export const KNOWN_IMG_SRC_ATTRIBUTES = ["data-lazy-src", "data-src", "src"];

/**
 * Default image URL sources (`srcset` first, then src attributes).
 */
export const DEFAULT_IMG_URL_SOURCES: (string | ValueSource)[] = [
    {
        source: "srcset",
        attributes: KNOWN_IMG_SRCSET_ATTRIBUTES,
        resolution: "high",
    },
    ...KNOWN_IMG_SRC_ATTRIBUTES,
];

/**
 * Default CSS selectors that match images with a known src or srcset attribute.
 */
export const DEFAULT_IMG_SELECTORS = [...KNOWN_IMG_SRCSET_ATTRIBUTES, ...KNOWN_IMG_SRC_ATTRIBUTES]
    .map((attribute) => `img[${attribute}]`);

/**
 * Known anchor attributes.
 * This maps to the `attributes` property of the `href` value source.
 */
export const KNOWN_ANCHOR_ATTRIBUTES = ["href"];

/**
 * Builds the attribute list for reading link URLs: `extra` first, then `href`.
 */
export function resolveUrlAttributes(extra?: readonly string[]): string[] {
    return [...(extra ?? []), ...KNOWN_ANCHOR_ATTRIBUTES];
}

/**
 * Resolves the first usable absolute URL from `sources` against `element`.
 * String entries read attributes; object entries use {@link resolveValue}.
 */
export function resolveUrlFromSources(
    element: HTMLElement,
    sources: readonly (string | ValueSource)[],
    base?: string,
): string | null {
    for (const source of sources) {
        if (typeof source === "string") {
            const value = getFirstElementAttributeValue(element, [source])?.trim();
            if (value != null && value.length > 0) {
                const normalized = tryNormalizeUrl(value, base);
                if (normalized != null) {
                    return normalized;
                }
            }
            continue;
        }

        const value = resolveValue(source, element)?.trim();
        if (value != null && value.length > 0) {
            const normalized = tryNormalizeUrl(value, base);
            if (normalized != null) {
                return normalized;
            }
        }
    }

    return null;
}
