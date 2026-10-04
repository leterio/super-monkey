import { sanitizeCssWithAmpersandPlaceholder } from "../../utils/dom/style";
import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { readStringList, reportUnrecognizedKeys } from "../../utils/opts/opts-fields";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";

/** Per-group History binder. The object key is the Content Manager group name. */
export type HistoryGroupOpts = {
    readonly newContentSelectors?: readonly string[];
    readonly recordFilter?: readonly string[];
    readonly decorateFilter?: readonly string[];
    readonly viewedStyles?: string;
    readonly listedStyles?: string;
};

export type HistoryOpts = ModuleOpts & {
    readonly groups: Readonly<Record<string, HistoryGroupOpts>>;
};

const GROUP_BINDER_KEYS = [
    "newContentSelectors",
    "recordFilter",
    "decorateFilter",
    "viewedStyles",
    "listedStyles",
] as const;

/**
 * Normalizes History opts before load.
 * Missing `groups` or no usable binder omits `value`.
 * Bad filters, selectors, and styles are dropped or cleaned as repairs.
 */
export function normalizeHistoryOpts(raw: unknown): Normalized<HistoryOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<HistoryOpts>(undefined);
    }

    reportUnrecognizedKeys(raw, ["groups"], "", walk);

    if (!isPlainObject(raw.groups)) {
        walk.reject("groups", "must be an object with at least one usable group binder");
        return walk.finish<HistoryOpts>(undefined);
    }

    const groups: Record<string, HistoryGroupOpts> = {};

    for (const [groupKey, binderRaw] of Object.entries(raw.groups)) {
        const trimmedKey = groupKey.trim();
        const groupPath = trimmedKey.length > 0 ? `groups.${trimmedKey}` : `groups.${groupKey}`;

        if (trimmedKey.length === 0) {
            walk.repair("groups", "group names must be non-empty");
            continue;
        }

        if (Object.hasOwn(groups, trimmedKey)) {
            walk.repair(groupPath, "duplicate group name");
            continue;
        }

        const binder = normalizeGroupBinder(binderRaw, groupPath, walk);
        if (binder == null) {
            continue;
        }

        groups[trimmedKey] = binder;
    }

    if (Object.keys(groups).length === 0) {
        walk.reject("groups", "at least one usable group binder is required");
        return walk.finish<HistoryOpts>(undefined);
    }

    return walk.finish({ groups });
}

function normalizeGroupBinder(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): HistoryGroupOpts | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "binder must be an object");
        return undefined;
    }

    reportUnrecognizedKeys(raw, GROUP_BINDER_KEYS, path, walk);

    const newContentSelectors = readStringList(
        raw.newContentSelectors,
        `${path}.newContentSelectors`,
        walk,
        { label: "newContentSelectors" },
    );
    const recordFilter = readStringList(raw.recordFilter, `${path}.recordFilter`, walk, {
        label: "recordFilter",
    });
    const decorateFilter = readStringList(raw.decorateFilter, `${path}.decorateFilter`, walk, {
        label: "decorateFilter",
    });
    const viewedStyles = readAmpersandCssField(raw.viewedStyles, `${path}.viewedStyles`, walk);
    const listedStyles = readAmpersandCssField(raw.listedStyles, `${path}.listedStyles`, walk);

    return {
        ...(newContentSelectors != null ? { newContentSelectors } : {}),
        ...(recordFilter != null ? { recordFilter } : {}),
        ...(decorateFilter != null ? { decorateFilter } : {}),
        ...(viewedStyles != null ? { viewedStyles } : {}),
        ...(listedStyles != null ? { listedStyles } : {}),
    };
}

function readAmpersandCssField(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): string | undefined {
    if (raw == null) {
        return undefined;
    }

    if (typeof raw !== "string") {
        walk.repair(path, "must be a string");
        return undefined;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    const sanitized = sanitizeCssWithAmpersandPlaceholder(trimmed);
    if (sanitized.css.length === 0) {
        walk.repair(path, "no usable CSS rules with & placeholder");
        return undefined;
    }

    if (sanitized.repairedSelectors) {
        walk.repair(path, "selectors missing & were prefixed with &");
    }

    return sanitized.css;
}
