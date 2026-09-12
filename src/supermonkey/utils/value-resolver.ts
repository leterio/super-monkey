import { applyValueMappers, type ValueMapper } from "./value-mappers";
import { getFirstElementAttributeValue } from "./dom/elements";
import { queryAll, type QueryableBaseElement } from "./dom/query";

/**
 * Resolves a string from attributes on a caller-supplied element.
 * Tries `attributes` in order; the first non-empty value wins.
 * Optional `selectors` locate elements under a document or subtree.
 */
export type AttributeValueSource = {
    readonly source: "attribute";
    readonly attributes: string[];
    readonly selectors?: string[];
    readonly map?: ValueMapper[];
};

/**
 * Resolves a string from the text content of a caller-supplied element.
 */
export type TextValueSource = {
    readonly source: "text";
    readonly selectors?: string[];
    readonly map?: ValueMapper[];
};

/**
 * Picks a URL from a srcset-like attribute on a caller-supplied element.
 */
export type SrcSetValueSource = {
    readonly source: "srcset";
    readonly attributes: string[];
    readonly resolution?: "high" | "low" | string;
    readonly selectors?: string[];
    readonly map?: ValueMapper[];
};

/** Value sources that require an `HTMLElement` from the caller (or `selectors` under a base). */
export type ElementValueSource = AttributeValueSource | TextValueSource | SrcSetValueSource;

/**
 * Reads a query parameter from the current tab location.
 */
export type QueryParamValueSource = {
    readonly source: "query-param";
    readonly key: string;
    readonly map?: ValueMapper[];
};

/**
 * Reads the pathname from the current tab location.
 */
export type PathValueSource = {
    readonly source: "path";
    readonly map?: ValueMapper[];
};

/** Value sources that operate on the current tab URL. */
export type UrlValueSource = QueryParamValueSource | PathValueSource;

/**
 * Extracts a string from the page for integration-authored value fields.
 * Element sources need a base element from the caller; URL sources use the tab location.
 */
export type ValueSource = ElementValueSource | UrlValueSource;

type SrcSetCandidate = {
    readonly url: string;
    readonly descriptor: string | null;
    readonly width: number | null;
    readonly density: number | null;
};

/**
 * Resolves a string from `valueSource`.
 * Element sources require `element` (or resolve via `selectors` under that base); URL sources use the tab location.
 * Returns `null` when the source cannot produce a non-empty value.
 */
export function resolveValue(
    valueSource: ValueSource | null | undefined,
    element?: HTMLElement | Document | null,
): string | null {
    if (valueSource == null) {
        return null;
    }

    if (valueSource.source === "query-param" || valueSource.source === "path") {
        return resolveUrlSource(valueSource);
    }

    const target = resolveElementTargets(valueSource, element)[0];
    if (target == null) {
        return null;
    }

    return resolveFromElement(valueSource, target);
}

/**
 * Resolves every distinct non-empty value from `valueSource` under `base`.
 * URL sources return at most one value from the tab location.
 */
export function resolveAllValues(
    valueSource: ValueSource | null | undefined,
    base?: QueryableBaseElement | Document | null,
): string[] {
    if (valueSource == null) {
        return [];
    }

    if (valueSource.source === "query-param" || valueSource.source === "path") {
        const value = resolveUrlSource(valueSource);
        return value == null ? [] : [value];
    }

    const values: string[] = [];
    const seen = new Set<string>();

    for (const element of resolveElementTargets(valueSource, base)) {
        const value = resolveFromElement(valueSource, element)?.trim();
        if (value == null || value.length === 0 || seen.has(value)) {
            continue;
        }
        seen.add(value);
        values.push(value);
    }

    return values;
}

function resolveUrlSource(valueSource: UrlValueSource): string | null {
    let raw: string | null = null;

    switch (valueSource.source) {
        case "query-param": {
            if (valueSource.key.length === 0) {
                return null;
            }
            const value = new URL(window.location.href).searchParams.get(valueSource.key);
            raw = value != null && value.length > 0 ? value : null;
            break;
        }
        case "path": {
            const pathname = window.location.pathname;
            raw = pathname.length > 0 ? pathname : null;
            break;
        }
    }

    if (raw == null || raw.length === 0) {
        return null;
    }

    return applyValueMappers(raw, valueSource.map ?? []);
}

function resolveElementTargets(
    valueSource: ElementValueSource,
    base?: QueryableBaseElement | Document | null,
): HTMLElement[] {
    const selectors = valueSource.selectors;
    if (selectors != null && selectors.length > 0) {
        return queryAll(selectors, base ?? undefined);
    }

    if (base instanceof HTMLElement) {
        return [base];
    }

    return [];
}

function resolveFromElement(valueSource: ElementValueSource, element: HTMLElement): string | null {
    let raw: string | null = null;

    switch (valueSource.source) {
        case "attribute": {
            raw = getFirstElementAttributeValue(element, valueSource.attributes);
            break;
        }
        case "text": {
            const text = element.textContent?.trim();
            raw = text != null && text.length > 0 ? text : null;
            break;
        }
        case "srcset": {
            raw = resolveSrcSetValue(valueSource, element);
            break;
        }
    }

    if (raw == null || raw.length === 0) {
        return null;
    }

    return applyValueMappers(raw, valueSource.map ?? []);
}

function resolveSrcSetValue(valueSource: SrcSetValueSource, element: HTMLElement): string | null {
    const raw = getFirstElementAttributeValue(element, valueSource.attributes);
    if (raw == null || raw.length === 0) {
        return null;
    }

    return pickSrcSetUrl(parseSrcSet(raw), valueSource.resolution ?? "high");
}

function parseSrcSet(raw: string): SrcSetCandidate[] {
    const candidates: SrcSetCandidate[] = [];

    for (const part of raw.split(",")) {
        const trimmed = part.trim();
        if (trimmed.length === 0) {
            continue;
        }

        const tokens = trimmed.split(/\s+/);
        const url = tokens[0];
        if (url == null || url.length === 0) {
            continue;
        }

        const descriptor = tokens[1] ?? null;
        let width: number | null = null;
        let density: number | null = null;

        if (descriptor != null) {
            if (descriptor.endsWith("w")) {
                const parsed = Number.parseFloat(descriptor.slice(0, -1));
                width = Number.isFinite(parsed) ? parsed : null;
            } else if (descriptor.endsWith("x")) {
                const parsed = Number.parseFloat(descriptor.slice(0, -1));
                density = Number.isFinite(parsed) ? parsed : null;
            }
        }

        candidates.push({ url, descriptor, width, density });
    }

    return candidates;
}

function pickSrcSetUrl(
    candidates: SrcSetCandidate[],
    resolution: "high" | "low" | string = "high",
): string | null {
    if (candidates.length === 0) {
        return null;
    }

    if (resolution !== "high" && resolution !== "low") {
        const exact = candidates.find((candidate) => candidate.descriptor === resolution);
        return exact?.url ?? null;
    }

    const withWidth = candidates.filter((candidate) => candidate.width != null);
    if (withWidth.length > 0) {
        const sorted = [...withWidth].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
        return (resolution === "high" ? sorted[sorted.length - 1] : sorted[0])?.url ?? null;
    }

    const withDensity = candidates.filter((candidate) => candidate.density != null);
    if (withDensity.length > 0) {
        const sorted = [...withDensity].sort((a, b) => (a.density ?? 0) - (b.density ?? 0));
        return (resolution === "high" ? sorted[sorted.length - 1] : sorted[0])?.url ?? null;
    }

    return (resolution === "high" ? candidates[candidates.length - 1] : candidates[0])?.url ?? null;
}
