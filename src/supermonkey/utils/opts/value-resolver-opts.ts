import { OptsNormalization } from "./normalization";
import { readStringList } from "./opts-fields";
import { safeCompileRegExp } from "../regex";
import { isPlainObject } from "../type";
import type {
    JsonPathMapper,
    PickMapper,
    SortKey,
    SortMapper,
    ValueMapper,
} from "../value-mappers";
import type { ValueSource } from "../value-resolver";
import { trimToUndefined } from "../string";
import { KNOWN_IMG_SRCSET_ATTRIBUTES } from "../links";

const VALUE_SOURCE_KINDS = ["attribute", "text", "srcset", "query-param", "path"] as const;
type ValueSourceKind = (typeof VALUE_SOURCE_KINDS)[number];

const VALUE_MAPPER_TYPES = ["extract", "replace", "json_path", "sort", "pick"] as const;

/**
 * Normalizes one value source object into `walk`.
 * @returns The normalized source, or `undefined` when unusable
 */
export function normalizeValueSource(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ValueSource | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "value source must be an object");
        return undefined;
    }

    if (!isValueSourceKind(raw.source)) {
        walk.repair(
            `${path}.source`,
            'source must be "attribute", "text", "srcset", "query-param", or "path"',
        );
        return undefined;
    }

    switch (raw.source) {
        case "attribute":
            return sanitizeAttributeSource(raw, path, walk);
        case "text":
            return sanitizeTextSource(raw, path, walk);
        case "srcset":
            return sanitizeSrcSetSource(raw, path, walk);
        case "query-param":
            return sanitizeQueryParamSource(raw, path, walk);
        case "path":
            return sanitizeBareSource("path", raw, path, walk);
    }
}

/**
 * Normalizes a non-empty array of value sources into `walk`.
 * Unusable entries are dropped; a repair finding is collected when none remain.
 */
export function normalizeValueSources(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ValueSource[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        walk.repair(path, "must be a non-empty array");
        return [];
    }

    const sources: ValueSource[] = [];
    for (const [index, item] of raw.entries()) {
        const normalized = normalizeValueSource(item, `${path}[${index}]`, walk);
        if (normalized != null) {
            sources.push(normalized);
        }
    }

    if (sources.length === 0) {
        walk.repair(path, "at least one usable value source is required");
    }

    return sources;
}

function sanitizeAttributeSource(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): ValueSource | undefined {
    const attributes = readStringList(raw.attributes, `${path}.attributes`, walk, {
        required: true,
        label: "attributes",
    });

    if (attributes == null) {
        if (raw.map != null) {
            sanitizeMap(raw.map, `${path}.map`, walk);
        }
        return undefined;
    }

    const selectors = readStringList(raw.selectors, `${path}.selectors`, walk, {
        label: "selectors",
    });

    return withOptionalMap(
        {
            source: "attribute",
            attributes,
            ...(selectors != null ? { selectors } : {}),
        },
        raw.map,
        path,
        walk,
    );
}

function sanitizeTextSource(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): ValueSource | undefined {
    const selectors = readStringList(raw.selectors, `${path}.selectors`, walk, {
        label: "selectors",
    });

    return withOptionalMap(
        {
            source: "text",
            ...(selectors != null ? { selectors } : {}),
        },
        raw.map,
        path,
        walk,
    );
}

function sanitizeSrcSetSource(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): ValueSource | undefined {
    const attributes = readStringList(raw.attributes, `${path}.attributes`, walk, {
        label: "attributes",
    }) ?? [...KNOWN_IMG_SRCSET_ATTRIBUTES];

    const selectors = readStringList(raw.selectors, `${path}.selectors`, walk, {
        label: "selectors",
    });

    let resolution: string | undefined;
    if (raw.resolution != null) {
        if (typeof raw.resolution === "string" && raw.resolution.trim().length > 0) {
            resolution = raw.resolution.trim();
        } else {
            walk.repair(`${path}.resolution`, "resolution must be a non-empty string");
        }
    }

    return withOptionalMap(
        {
            source: "srcset",
            attributes,
            ...(selectors != null ? { selectors } : {}),
            ...(resolution != null ? { resolution } : {}),
        },
        raw.map,
        path,
        walk,
    );
}

function sanitizeQueryParamSource(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): ValueSource | undefined {
    const key = trimToUndefined(raw.key);
    if (key == null) {
        walk.repair(`${path}.key`, "key is required");
        if (raw.map != null) {
            sanitizeMap(raw.map, `${path}.map`, walk);
        }
        return undefined;
    }

    return withOptionalMap({ source: "query-param", key }, raw.map, path, walk);
}

function sanitizeBareSource(
    source: "path",
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): ValueSource | undefined {
    return withOptionalMap({ source }, raw.map, path, walk);
}

function withOptionalMap<T extends ValueSource>(
    source: T,
    rawMap: unknown,
    path: string,
    walk: OptsNormalization,
): T | undefined {
    if (rawMap == null) {
        return source;
    }

    const map = sanitizeMap(rawMap, `${path}.map`, walk);
    if (map == null) {
        return undefined;
    }

    return { ...source, map };
}

function sanitizeMap(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ValueMapper[] | undefined {
    if (!Array.isArray(raw)) {
        walk.repair(path, "map must be a non-empty array");
        return undefined;
    }

    if (raw.length === 0) {
        walk.repair(path, "map must be a non-empty array");
        return undefined;
    }

    const mappers: ValueMapper[] = [];
    for (const [index, entry] of raw.entries()) {
        const mapper = sanitizeMapper(entry, `${path}[${index}]`, walk);
        if (mapper != null) {
            mappers.push(mapper);
        }
    }

    if (mappers.length === 0) {
        walk.repair(path, "at least one usable map step is required");
        return undefined;
    }

    return mappers;
}

function sanitizeMapper(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): ValueMapper | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "map step must be an object");
        return undefined;
    }

    if (!isValueMapperType(raw.type)) {
        walk.repair(
            `${path}.type`,
            'type must be "extract", "replace", "json_path", "sort", or "pick"',
        );
        return undefined;
    }

    switch (raw.type) {
        case "extract":
        case "replace":
            return sanitizeRegexMapper(raw, path, walk);
        case "json_path":
            return sanitizeJsonPathMapper(raw, path, walk);
        case "sort":
            return sanitizeSortMapper(raw, path, walk);
        case "pick":
            return sanitizePickMapper(raw, path, walk);
    }
}

function sanitizeRegexMapper(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): ValueMapper | undefined {
    const regexes = sanitizeRegexes(raw.regexes, `${path}.regexes`, walk);
    if (regexes == null) {
        return undefined;
    }

    if (raw.type === "replace") {
        if (typeof raw.replacement !== "string") {
            walk.repair(`${path}.replacement`, "replacement is required");
            return undefined;
        }

        return { type: "replace", regexes, replacement: raw.replacement };
    }

    const captureGroup = sanitizeCaptureGroup(raw.captureGroup, `${path}.captureGroup`, walk);
    if (captureGroup == null) {
        return { type: "extract", regexes };
    }

    return { type: "extract", regexes, captureGroup };
}

function sanitizeJsonPathMapper(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): JsonPathMapper | undefined {
    const jsonPath = trimToUndefined(raw.path);
    if (jsonPath == null) {
        walk.repair(`${path}.path`, "path is required");
        return undefined;
    }

    return { type: "json_path", path: jsonPath };
}

function sanitizeSortMapper(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): SortMapper | undefined {
    const by = sanitizeSortKey(raw.by, `${path}.by`, walk);
    if (by == null) {
        return undefined;
    }

    let order: "asc" | "desc" | undefined;
    if (raw.order != null) {
        if (raw.order === "asc" || raw.order === "desc") {
            order = raw.order;
        } else {
            walk.repair(`${path}.order`, 'order must be "asc" or "desc"');
        }
    }

    return {
        type: "sort",
        by,
        ...(order != null ? { order } : {}),
    };
}

function sanitizeSortKey(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): SortKey | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "by must be an object");
        return undefined;
    }

    if (raw.path != null && raw.area != null) {
        walk.repair(path, "by must define either path or area");
        return undefined;
    }

    if (typeof raw.path === "string") {
        const fieldPath = trimToUndefined(raw.path);
        if (fieldPath == null) {
            walk.repair(`${path}.path`, "path must be a non-empty string");
            return undefined;
        }
        return { path: fieldPath };
    }

    if (raw.area != null) {
        if (!isPlainObject(raw.area)) {
            walk.repair(`${path}.area`, "area must be an object");
            return undefined;
        }

        const width = trimToUndefined(raw.area.width);
        const height = trimToUndefined(raw.area.height);
        if (width == null || height == null) {
            walk.repair(`${path}.area`, "area requires width and height paths");
            return undefined;
        }

        return { area: { width, height } };
    }

    walk.repair(path, "by must define path or area");
    return undefined;
}

function sanitizePickMapper(
    raw: Record<string, unknown>,
    path: string,
    walk: OptsNormalization,
): PickMapper | undefined {
    if (raw.at !== "first" && raw.at !== "last") {
        walk.repair(`${path}.at`, 'at must be "first" or "last"');
        return undefined;
    }

    return { type: "pick", at: raw.at };
}

function sanitizeRegexes(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): string[] | undefined {
    const patterns = readStringList(raw, path, walk, {
        required: true,
        label: "regexes",
    });
    if (patterns == null) {
        return undefined;
    }

    const regexes = patterns.filter((pattern) => safeCompileRegExp(pattern) != null);

    if (regexes.length === 0) {
        walk.repair(path, "at least one valid regex is required");
        return undefined;
    }

    if (regexes.length !== patterns.length) {
        walk.repair(path, "ignored invalid regexes");
    }

    return regexes;
}

function sanitizeCaptureGroup(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): number | undefined {
    if (raw == null) {
        return undefined;
    }

    if (!Number.isInteger(raw) || (raw as number) < 0) {
        walk.repair(path, "captureGroup must be a non-negative integer");
        return undefined;
    }

    return raw as number;
}

function isValueSourceKind(value: unknown): value is ValueSourceKind {
    return VALUE_SOURCE_KINDS.includes(value as ValueSourceKind);
}

function isValueMapperType(value: unknown): value is (typeof VALUE_MAPPER_TYPES)[number] {
    return VALUE_MAPPER_TYPES.includes(value as (typeof VALUE_MAPPER_TYPES)[number]);
}
