import { applyRegexMapper, type RegexMapper } from "./regex";
import { isPlainObject } from "./type";

/**
 * Walks a dotted path (`a.b.0.c`) on a JSON value.
 */
export type JsonPathMapper = {
    readonly type: "json_path";
    readonly path: string;
};

/**
 * Sorts an array by a single field path or by width×height area.
 */
export type SortMapper = {
    readonly type: "sort";
    readonly by: SortKey;
    readonly order?: "asc" | "desc";
};

/** Sort key: a dotted field path, or width×height area paths. */
export type SortKey =
    | { readonly path: string }
    | { readonly area: { readonly width: string; readonly height: string } };

/**
 * Picks the first or last entry of an array.
 */
export type PickMapper = {
    readonly type: "pick";
    readonly at: "first" | "last";
};

/**
 * Post-processing step applied after a value source reads a raw string.
 * Steps may be chained; structured mappers parse JSON when needed.
 */
export type ValueMapper = RegexMapper | JsonPathMapper | SortMapper | PickMapper;

/**
 * Applies `mappers` in order to `value`.
 * Returns a non-empty string, or `null` when the chain cannot produce one.
 */
export function applyValueMappers(
    value: unknown,
    mappers: readonly ValueMapper[],
): string | null {
    let current: unknown = value;

    for (const mapper of mappers) {
        current = applyOneMapper(current, mapper);
        if (current == null) {
            return null;
        }
    }

    return finalizeMappedValue(current);
}

function applyOneMapper(value: unknown, mapper: ValueMapper): unknown {
    switch (mapper.type) {
        case "extract":
        case "replace": {
            if (typeof value !== "string") {
                return null;
            }
            return applyRegexMapper(value, mapper);
        }
        case "json_path": {
            const structured = ensureStructured(value);
            if (structured == null) {
                return null;
            }
            return getAtPath(structured, mapper.path);
        }
        case "sort": {
            const structured = ensureStructured(value);
            if (!Array.isArray(structured)) {
                return null;
            }
            return sortArray(structured, mapper);
        }
        case "pick": {
            const structured = ensureStructured(value);
            if (!Array.isArray(structured) || structured.length === 0) {
                return null;
            }
            return mapper.at === "first"
                ? structured[0]
                : structured[structured.length - 1];
        }
        default: {
            return null;
        }
    }
}

function ensureStructured(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }

    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return null;
    }
}

function getAtPath(root: unknown, path: string): unknown {
    const segments = path.split(".").map((segment) => segment.trim()).filter((segment) => segment.length > 0);
    if (segments.length === 0) {
        return null;
    }

    let current: unknown = root;
    for (const segment of segments) {
        if (current == null) {
            return null;
        }

        if (Array.isArray(current)) {
            const index = Number.parseInt(segment, 10);
            if (!Number.isInteger(index) || String(index) !== segment) {
                return null;
            }
            current = current[index];
            continue;
        }

        if (!isPlainObject(current)) {
            return null;
        }

        current = current[segment];
    }

    return current === undefined ? null : current;
}

function sortArray(items: unknown[], mapper: SortMapper): unknown[] {
    const order = mapper.order === "desc" ? -1 : 1;
    const decorated = items.map((item, index) => ({
        item,
        index,
        key: sortKeyFor(item, mapper.by),
    }));

    decorated.sort((left, right) => {
        const compared = compareSortKeys(left.key, right.key);
        if (compared !== 0) {
            return compared * order;
        }
        return left.index - right.index;
    });

    return decorated.map((entry) => entry.item);
}

type SortKeyValue =
    | { readonly kind: "number"; readonly value: number }
    | { readonly kind: "string"; readonly value: string }
    | { readonly kind: "missing" };

function sortKeyFor(item: unknown, by: SortKey): SortKeyValue {
    if ("area" in by) {
        const width = toFiniteNumber(getAtPath(item, by.area.width));
        const height = toFiniteNumber(getAtPath(item, by.area.height));
        if (width == null || height == null) {
            return { kind: "missing" };
        }
        return { kind: "number", value: width * height };
    }

    const raw = getAtPath(item, by.path);
    const asNumber = toFiniteNumber(raw);
    if (asNumber != null) {
        return { kind: "number", value: asNumber };
    }

    if (typeof raw === "string") {
        return { kind: "string", value: raw };
    }

    if (typeof raw === "boolean") {
        return { kind: "string", value: String(raw) };
    }

    return { kind: "missing" };
}

function compareSortKeys(left: SortKeyValue, right: SortKeyValue): number {
    if (left.kind === "missing" && right.kind === "missing") {
        return 0;
    }
    if (left.kind === "missing") {
        return -1;
    }
    if (right.kind === "missing") {
        return 1;
    }

    if (left.kind === "number" && right.kind === "number") {
        return left.value - right.value;
    }

    if (left.kind === "string" && right.kind === "string") {
        return left.value.localeCompare(right.value);
    }

    // Prefer numbers over strings when mixed.
    if (left.kind === "number") {
        return -1;
    }
    return 1;
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function finalizeMappedValue(value: unknown): string | null {
    if (typeof value === "string") {
        return value.length > 0 ? value : null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        const asString = String(value);
        return asString.length > 0 ? asString : null;
    }

    return null;
}
