import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { readStringList } from "../../utils/opts/opts-fields";
import { normalizeValueSource } from "../../utils/opts/value-resolver-opts";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";
import type { DomContextManagerOpts } from "./context-manager/dom-context-manager";
import type { UrlContextManagerOpts } from "./context-manager/url-context-manager";
import type { PageIndexDecoration, PaginatorSelectors } from "./metadata";
import { NUMBERS_PLACEHOLDER } from "./metadata";
import type { PageFetcherRequestOpts } from "./page-fetcher/page-fetcher";
import type { NumberedPagingStrategyOpts } from "./paging-strategy/numbered-paging-strategy";
import {
    hasPageNumberPlaceholder,
    isValidUrlTemplatePath,
    type UrlTemplate,
} from "./url-template";

/** Discriminated opts for `contextManager.type: "dom"`. */
export type DomContextManagerConfig = DomContextManagerOpts & {
    readonly type: "dom";
};

/** Discriminated opts for `contextManager.type: "url"`. */
export type UrlContextManagerConfig = UrlContextManagerOpts & {
    readonly type: "url";
};

/** Normalized `contextManager` object on Additional Pages opts. */
export type ContextManagerConfig = DomContextManagerConfig | UrlContextManagerConfig;

/** Discriminated opts for `pagingStrategy.type: "next-link"`. */
export type NextLinkPagingStrategyConfig = {
    readonly type: "next-link";
};

/** Discriminated opts for `pagingStrategy.type: "incremental"`. */
export type IncrementalPagingStrategyConfig = NumberedPagingStrategyOpts & {
    readonly type: "incremental";
};

/** Discriminated opts for `pagingStrategy.type: "decremental"`. */
export type DecrementalPagingStrategyConfig = NumberedPagingStrategyOpts & {
    readonly type: "decremental";
};

/** Normalized `pagingStrategy` object on Additional Pages opts. */
export type PagingStrategyConfig =
    | NextLinkPagingStrategyConfig
    | IncrementalPagingStrategyConfig
    | DecrementalPagingStrategyConfig;

/** One Content Manager group binder on Additional Pages opts. */
export type AdditionalPagesGroupBinder = {
    readonly contextManager: ContextManagerConfig;
    readonly pagingStrategy: PagingStrategyConfig;
    readonly pageRequestOpts?: PageFetcherRequestOpts;
};

/** Integration opts for the Additional Pages module (`module: "AdditionalPages"`). */
export type AdditionalPagesOpts = ModuleOpts & {
    readonly groups: Readonly<Record<string, AdditionalPagesGroupBinder>>;
};

/**
 * Normalizes Additional Pages opts before load.
 * Missing or unusable group binders omit `value`.
 */
export function normalizeAdditionalPagesOpts(raw: unknown): Normalized<AdditionalPagesOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<AdditionalPagesOpts>(undefined);
    }

    if ("contextManager" in raw || "pagingStrategy" in raw) {
        walk.reject(
            "opts",
            'flat contextManager/pagingStrategy is not supported; use groups.<contentManagerGroupKey>',
        );
        return walk.finish<AdditionalPagesOpts>(undefined);
    }

    if (!isPlainObject(raw.groups)) {
        walk.reject("groups", "must be an object with at least one usable group binder");
        return walk.finish<AdditionalPagesOpts>(undefined);
    }

    const groups: Record<string, AdditionalPagesGroupBinder> = {};

    for (const [groupKey, binderRaw] of Object.entries(raw.groups)) {
        const trimmedKey = groupKey.trim();
        const groupPath =
            trimmedKey.length > 0 ? `groups.${trimmedKey}` : `groups.${groupKey}`;

        if (trimmedKey.length === 0) {
            walk.repair("groups", "group names must be non-empty");
            continue;
        }

        if (!isPlainObject(binderRaw)) {
            walk.repair(groupPath, "binder must be an object");
            continue;
        }

        const binderWalk = new OptsNormalization();
        const contextManager = normalizeContextManager(
            binderRaw.contextManager,
            binderWalk,
            `${groupPath}.contextManager`,
        );
        const pagingStrategy = normalizePagingStrategy(
            binderRaw.pagingStrategy,
            binderWalk,
            `${groupPath}.pagingStrategy`,
        );

        let binder: AdditionalPagesGroupBinder | undefined;
        if (
            contextManager != null &&
            pagingStrategy != null &&
            validateContextAndStrategyPair(
                contextManager,
                pagingStrategy,
                binderWalk,
                `${groupPath}.contextManager`,
                `${groupPath}.pagingStrategy`,
            )
        ) {
            const pageRequestOpts = normalizePageRequestOpts(
                binderRaw.pageRequestOpts,
                binderWalk,
                `${groupPath}.pageRequestOpts`,
            );

            binder = {
                contextManager,
                pagingStrategy,
                ...(pageRequestOpts != null ? { pageRequestOpts } : {}),
            };
        }

        const normalizedBinder = binderWalk.finish(binder);
        for (const finding of normalizedBinder.findings) {
            walk.repair(finding.path, finding.message);
        }

        if (normalizedBinder.value == null) {
            walk.repair(groupPath, "binder is unusable");
            continue;
        }

        groups[trimmedKey] = normalizedBinder.value;
    }

    if (Object.keys(groups).length === 0) {
        walk.reject("groups", "at least one usable group binder is required");
        return walk.finish<AdditionalPagesOpts>(undefined);
    }

    return walk.finish({ groups });
}

function normalizeContextManager(
    raw: unknown,
    walk: OptsNormalization,
    pathPrefix = "contextManager",
): ContextManagerConfig | undefined {
    if (!isPlainObject(raw)) {
        walk.reject(pathPrefix, "must be an object");
        return undefined;
    }

    const type = typeof raw.type === "string" ? raw.type.trim() : "";
    switch (type) {
        case "dom":
            return normalizeDomContextManager(raw, walk, pathPrefix);
        case "url":
            return normalizeUrlContextManager(raw, walk, pathPrefix);
        default:
            walk.reject(`${pathPrefix}.type`, 'must be "dom" or "url"');
            return undefined;
    }
}

function normalizeUrlContextManager(
    raw: Record<string, unknown>,
    walk: OptsNormalization,
    pathPrefix: string,
): UrlContextManagerConfig | undefined {
    const urlTemplate = readUrlTemplate(
        raw.urlTemplate,
        `${pathPrefix}.urlTemplate`,
        walk,
        { required: true },
    );
    if (urlTemplate == null) {
        return undefined;
    }

    return { type: "url", urlTemplate };
}

function normalizeDomContextManager(
    raw: Record<string, unknown>,
    walk: OptsNormalization,
    pathPrefix: string,
): DomContextManagerConfig | undefined {
    const paginatorSelectors = normalizePaginatorSelectors(
        raw.paginatorSelectors,
        walk,
        `${pathPrefix}.paginatorSelectors`,
    );
    if (paginatorSelectors == null) {
        return undefined;
    }

    const urlTemplate = readUrlTemplate(
        raw.urlTemplate,
        `${pathPrefix}.urlTemplate`,
        walk,
        { required: false },
    );

    let ignoreLastPage: boolean | undefined;
    if (raw.ignoreLastPage != null) {
        if (typeof raw.ignoreLastPage === "boolean") {
            ignoreLastPage = raw.ignoreLastPage;
        } else {
            walk.repair(`${pathPrefix}.ignoreLastPage`, "must be a boolean");
        }
    }

    return {
        type: "dom",
        paginatorSelectors,
        ...(urlTemplate != null ? { urlTemplate } : {}),
        ...(ignoreLastPage != null ? { ignoreLastPage } : {}),
    };
}

function normalizePaginatorSelectors(
    raw: unknown,
    walk: OptsNormalization,
    pathPrefix: string,
): PaginatorSelectors | undefined {
    if (!isPlainObject(raw)) {
        walk.reject(pathPrefix, "paginatorSelectors is required");
        return undefined;
    }

    const rootContainers = readSelectorField(
        raw.rootContainers,
        `${pathPrefix}.rootContainers`,
        walk,
        true,
    );
    if (rootContainers == null) {
        return undefined;
    }

    const previousSelectors = readSelectorField(
        raw.previousSelectors,
        `${pathPrefix}.previousSelectors`,
        walk,
        false,
    );
    const nextSelectors = readSelectorField(
        raw.nextSelectors,
        `${pathPrefix}.nextSelectors`,
        walk,
        false,
    );
    const currentSelectors = readSelectorField(
        raw.currentSelectors,
        `${pathPrefix}.currentSelectors`,
        walk,
        false,
    );
    const pageIndexes = readSelectorField(
        raw.pageIndexes,
        `${pathPrefix}.pageIndexes`,
        walk,
        false,
    );
    const urlAttributes = readSelectorField(
        raw.urlAttributes,
        `${pathPrefix}.urlAttributes`,
        walk,
        false,
    );

    const pageIndexDecoration = normalizePageIndexDecoration(
        raw.pageIndexDecoration,
        raw.loadedPageClassNames,
        walk,
        `${pathPrefix}.pageIndexDecoration`,
        `${pathPrefix}.loadedPageClassNames`,
    );

    return {
        rootContainers,
        ...(previousSelectors != null ? { previousSelectors } : {}),
        ...(nextSelectors != null ? { nextSelectors } : {}),
        ...(currentSelectors != null ? { currentSelectors } : {}),
        ...(pageIndexes != null ? { pageIndexes } : {}),
        ...(urlAttributes != null ? { urlAttributes } : {}),
        ...(pageIndexDecoration != null ? { pageIndexDecoration } : {}),
    };
}

function normalizePageIndexDecoration(
    raw: unknown,
    legacyLoadedPageClassNames: unknown,
    walk: OptsNormalization,
    path: string,
    legacyPath: string,
): PageIndexDecoration | undefined {
    let block: Record<string, unknown> | undefined;
    if (raw == null) {
        block = undefined;
    } else if (!isPlainObject(raw)) {
        walk.repair(path, "pageIndexDecoration must be an object");
        block = undefined;
    } else {
        block = raw;
    }

    const closestSelectors = block != null
        ? readSelectorField(block.closestSelectors, `${path}.closestSelectors`, walk, false)
        : undefined;

    const useImmediateParent = block?.useImmediateParent === true;
    if (useImmediateParent && closestSelectors != null) {
        walk.repair(
            `${path}.closestSelectors`,
            "ignored closestSelectors because useImmediateParent takes precedence",
        );
    }

    let loadedPageClassNames = block != null
        ? readStringList(
            block.loadedPageClassNames,
            `${path}.loadedPageClassNames`,
            walk,
            { label: "class names", onEmpty: "repair" },
        )
        : undefined;

    const legacyClasses = readStringList(
        legacyLoadedPageClassNames,
        legacyPath,
        walk,
        { label: "class names", onEmpty: "repair" },
    );
    if (legacyClasses != null) {
        if (loadedPageClassNames == null) {
            walk.repair(legacyPath, "folded into pageIndexDecoration.loadedPageClassNames");
            loadedPageClassNames = legacyClasses;
        } else {
            walk.repair(legacyPath, "ignored because pageIndexDecoration.loadedPageClassNames is set");
        }
    }

    if (
        !useImmediateParent
        && closestSelectors == null
        && loadedPageClassNames == null
    ) {
        return undefined;
    }

    return {
        ...(useImmediateParent ? { useImmediateParent: true } : {}),
        ...(!useImmediateParent && closestSelectors != null ? { closestSelectors } : {}),
        ...(loadedPageClassNames != null ? { loadedPageClassNames } : {}),
    };
}

function readSelectorField(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
    required: boolean,
): string[] | undefined {
    if (raw == null) {
        if (required) {
            walk.reject(path, "is required");
        }
        return undefined;
    }

    if (!Array.isArray(raw)) {
        if (required) {
            walk.reject(path, "must be a string array");
        } else {
            walk.repair(path, "must be a string array");
        }
        return undefined;
    }

    const entries = readStringList(raw, path, walk, {
        label: "selectors",
        onEmpty: required ? "repair" : "omit",
    });

    if (entries == null && required) {
        walk.reject(path, "is required");
        return undefined;
    }

    return entries;
}

function normalizePagingStrategy(
    raw: unknown,
    walk: OptsNormalization,
    pathPrefix = "pagingStrategy",
): PagingStrategyConfig | undefined {
    if (!isPlainObject(raw)) {
        walk.reject(pathPrefix, "must be an object");
        return undefined;
    }

    const type = typeof raw.type === "string" ? raw.type.trim() : "";
    switch (type) {
        case "next-link":
            return { type: "next-link" };
        case "incremental":
            return normalizeNumberedPagingStrategy(raw, "incremental", walk, pathPrefix);
        case "decremental":
            return normalizeNumberedPagingStrategy(raw, "decremental", walk, pathPrefix);
        default:
            walk.reject(
                `${pathPrefix}.type`,
                'must be "next-link", "incremental", or "decremental"',
            );
            return undefined;
    }
}

function normalizeNumberedPagingStrategy(
    raw: Record<string, unknown>,
    type: "incremental" | "decremental",
    walk: OptsNormalization,
    pathPrefix: string,
): IncrementalPagingStrategyConfig | DecrementalPagingStrategyConfig {
    const numberingStartsFromZero = readOptionalBoolean(
        raw.numberingStartsFromZero,
        `${pathPrefix}.numberingStartsFromZero`,
        walk,
    );
    const numberingLabelStartsFromZero = readOptionalBoolean(
        raw.numberingLabelStartsFromZero,
        `${pathPrefix}.numberingLabelStartsFromZero`,
        walk,
    );

    return {
        type,
        ...(numberingStartsFromZero != null ? { numberingStartsFromZero } : {}),
        ...(numberingLabelStartsFromZero != null ? { numberingLabelStartsFromZero } : {}),
    };
}

function validateContextAndStrategyPair(
    contextManager: ContextManagerConfig,
    pagingStrategy: PagingStrategyConfig,
    walk: OptsNormalization,
    contextManagerPathPrefix = "contextManager",
    pagingStrategyPathPrefix = "pagingStrategy",
): boolean {
    if (pagingStrategy.type === "next-link") {
        if (contextManager.type !== "dom") {
            walk.repair(
                pagingStrategyPathPrefix,
                'type "next-link" requires contextManager.type "dom"',
            );
            return false;
        }

        const nextSelectors = contextManager.paginatorSelectors.nextSelectors;
        if (nextSelectors == null || nextSelectors.length === 0) {
            walk.repair(
                `${contextManagerPathPrefix}.paginatorSelectors.nextSelectors`,
                'required when pagingStrategy.type is "next-link"',
            );
            return false;
        }
        return true;
    }

    const urlTemplate = contextManager.urlTemplate;
    if (urlTemplate == null) {
        walk.repair(
            `${contextManagerPathPrefix}.urlTemplate`,
            `required with ${NUMBERS_PLACEHOLDER} when pagingStrategy.type is "${pagingStrategy.type}"`,
        );
        return false;
    }

    if (typeof urlTemplate === "string") {
        if (!hasPageNumberPlaceholder(urlTemplate)) {
            walk.repair(
                `${contextManagerPathPrefix}.urlTemplate`,
                `required with ${NUMBERS_PLACEHOLDER} when pagingStrategy.type is "${pagingStrategy.type}"`,
            );
            return false;
        }
        return true;
    }

    if ("template" in urlTemplate && !hasPageNumberPlaceholder(urlTemplate.template)) {
        walk.repair(
            `${contextManagerPathPrefix}.urlTemplate.template`,
            `required with ${NUMBERS_PLACEHOLDER} when pagingStrategy.type is "${pagingStrategy.type}"`,
        );
        return false;
    }

    return true;
}

function normalizePageRequestOpts(
    raw: unknown,
    walk: OptsNormalization,
    pathPrefix = "pageRequestOpts",
): PageFetcherRequestOpts | undefined {
    if (raw == null) {
        return undefined;
    }

    if (!isPlainObject(raw)) {
        walk.repair(pathPrefix, "must be an object");
        return undefined;
    }

    let method: string | undefined;
    if (raw.method != null) {
        if (typeof raw.method === "string" && raw.method.trim().length > 0) {
            method = raw.method.trim();
        } else {
            walk.repair(`${pathPrefix}.method`, "must be a non-empty string");
        }
    }

    let headers: Record<string, string> | undefined;
    if (raw.headers != null) {
        if (!isPlainObject(raw.headers)) {
            walk.repair(`${pathPrefix}.headers`, "must be an object");
        } else {
            const cleaned: Record<string, string> = {};
            for (const [key, value] of Object.entries(raw.headers)) {
                if (typeof value !== "string") {
                    walk.repair(`${pathPrefix}.headers.${key}`, "must be a string");
                    continue;
                }
                cleaned[key] = value;
            }
            if (Object.keys(cleaned).length > 0) {
                headers = cleaned;
            }
        }
    }

    if (method == null && headers == null) {
        return undefined;
    }

    return {
        ...(method != null ? { method } : {}),
        ...(headers != null ? { headers } : {}),
    };
}

function readUrlTemplate(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
    options: { required: boolean },
): UrlTemplate | undefined {
    if (raw == null) {
        if (options.required) {
            walk.reject(path, "urlTemplate is required");
        }
        return undefined;
    }

    if (typeof raw === "string") {
        return readStaticUrlTemplateString(raw, path, walk, options);
    }

    if (!isPlainObject(raw)) {
        if (options.required) {
            walk.reject(path, "must be a non-empty string or an object");
        } else {
            walk.repair(path, "must be a non-empty string or an object");
        }
        return undefined;
    }

    const hasTemplate = raw.template != null;
    const hasSource = raw.source != null;

    if (hasTemplate === hasSource) {
        const message = "must define exactly one of template or source";
        if (options.required) {
            walk.reject(path, message);
        } else {
            walk.repair(path, message);
        }
        return undefined;
    }

    const copyPageQueryParams = readCopyPageQueryParams(
        raw.copyPageQueryParams,
        `${path}.copyPageQueryParams`,
        walk,
    );

    if (hasTemplate) {
        const template = readStaticUrlTemplateString(
            raw.template,
            `${path}.template`,
            walk,
            options,
        );
        if (template == null) {
            return undefined;
        }

        return {
            template,
            copyPageQueryParams,
        };
    }

    const source = normalizeValueSource(raw.source, `${path}.source`, walk);
    if (source == null) {
        if (options.required) {
            walk.reject(`${path}.source`, "source is required");
        }
        return undefined;
    }

    return {
        source,
        copyPageQueryParams,
    };
}

function readStaticUrlTemplateString(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
    options: { required: boolean },
): string | undefined {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        if (options.required) {
            walk.reject(path, "must be a non-empty string");
        } else {
            walk.repair(path, "must be a non-empty string");
        }
        return undefined;
    }

    const urlTemplate = raw.trim();

    if (!hasPageNumberPlaceholder(urlTemplate)) {
        if (options.required) {
            walk.reject(path, `must include ${NUMBERS_PLACEHOLDER}`);
        } else {
            walk.repair(path, `must include ${NUMBERS_PLACEHOLDER}`);
        }
        return undefined;
    }

    if (!isValidUrlTemplatePath(urlTemplate)) {
        if (options.required) {
            walk.reject(
                path,
                "must be a path starting with '/' or an absolute http(s) URL",
            );
        } else {
            walk.repair(
                path,
                "must be a path starting with '/' or an absolute http(s) URL",
            );
        }
        return undefined;
    }

    return urlTemplate;
}

function readCopyPageQueryParams(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): boolean {
    if (raw == null) {
        return true;
    }

    if (typeof raw === "boolean") {
        return raw;
    }

    walk.repair(path, "must be a boolean");
    return true;
}

function readOptionalBoolean(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
): boolean | undefined {
    if (raw == null) {
        return undefined;
    }

    if (typeof raw === "boolean") {
        return raw;
    }

    walk.repair(path, "must be a boolean");
    return undefined;
}
