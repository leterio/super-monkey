import { sanitizeCssWithAmpersandPlaceholder } from "../../utils/dom/style";
import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { readStringList } from "../../utils/opts/opts-fields";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";

export type HistoryOpts = ModuleOpts & {
    readonly group: string;
    readonly newContentSelectors?: string[];
    readonly recordFilter?: string[];
    readonly decorateFilter?: string[];
    readonly viewedStyles?: string;
    readonly listedStyles?: string;
};

/**
 * Normalizes History opts before load.
 * Missing `group` omits `value`. Bad filters/selectors/styles are dropped or cleaned as repairs.
 */
export function normalizeHistoryOpts(raw: unknown): Normalized<HistoryOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<HistoryOpts>(undefined);
    }

    const group = typeof raw.group === "string" ? raw.group.trim() : "";
    if (group.length === 0) {
        walk.reject("group", "group is required");
        return walk.finish<HistoryOpts>(undefined);
    }

    const newContentSelectors = readStringList(
        raw.newContentSelectors,
        "newContentSelectors",
        walk,
        { label: "newContentSelectors" },
    );
    const recordFilter = readStringList(raw.recordFilter, "recordFilter", walk, {
        label: "recordFilter",
    });
    const decorateFilter = readStringList(raw.decorateFilter, "decorateFilter", walk, {
        label: "decorateFilter",
    });
    const viewedStyles = readAmpersandCssField(raw.viewedStyles, "viewedStyles", walk);
    const listedStyles = readAmpersandCssField(raw.listedStyles, "listedStyles", walk);

    return walk.finish({
        group,
        ...(newContentSelectors != null ? { newContentSelectors } : {}),
        ...(recordFilter != null ? { recordFilter } : {}),
        ...(decorateFilter != null ? { decorateFilter } : {}),
        ...(viewedStyles != null ? { viewedStyles } : {}),
        ...(listedStyles != null ? { listedStyles } : {}),
    });
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
