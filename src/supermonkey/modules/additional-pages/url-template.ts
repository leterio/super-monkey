import { parseInteger } from "../../utils/number";
import { escapeRegExp } from "../../utils/regex";
import { resolveValue, type ValueSource } from "../../utils/value-resolver";
import { NUMBERS_PLACEHOLDER } from "./metadata";

/** Static URL template with optional query-string copy from the current tab. */
export type UrlTemplateStaticConfig = {
    readonly template: string;
    /** When not `false`, copies the current tab query string onto built page URLs (default `true`). */
    readonly copyPageQueryParams?: boolean;
};

/**
 * Builds numbered page URLs from a ValueSource.
 * A `query-param` source uses `key` as the page parameter and the tab pathname as the base path.
 * Any other source resolves to a string that includes `{{NUMBER}}`.
 */
export type UrlTemplateSourceConfig = {
    readonly source: ValueSource;
    /** When not `false`, copies the current tab query string onto built page URLs (default `true`). */
    readonly copyPageQueryParams?: boolean;
};

/**
 * Appends a path suffix that contains `{{NUMBER}}` to the tab pathname.
 * A trailing page suffix already on the pathname is removed before the append.
 */
export type UrlTemplatePathSuffixConfig = {
    /** Path fragment starting with `/` and containing `{{NUMBER}}`, such as `/page/{{NUMBER}}`. */
    readonly pathSuffix: string;
    /** When not `false`, copies the current tab query string onto built page URLs (default `true`). */
    readonly copyPageQueryParams?: boolean;
};

/** Object form: exactly one of `template`, `source`, or `pathSuffix`. */
export type UrlTemplateConfig =
    | UrlTemplateStaticConfig
    | UrlTemplateSourceConfig
    | UrlTemplatePathSuffixConfig;

/** Authoring shape: string shorthand or object config. */
export type UrlTemplate = string | UrlTemplateConfig;

/** Snapshot used when building numbered page URLs. */
export type ResolvedUrlTemplate = {
    /**
     * Path or absolute URL.
     * Contains `{{NUMBER}}`, or is the tab pathname when `pageQueryParam` is set.
     */
    readonly template: string;
    /** Query params snapshotted from the live tab when `copyPageQueryParams` is enabled. */
    readonly queryParams: Record<string, string>;
    /**
     * Query parameter that carries the page number.
     * Written after copied query params, so the fetched page number overrides a copied value with the same key.
     */
    readonly pageQueryParam?: string;
};

function resolvePlaceholder(urlTemplate: string): string | null {
    const encodedPlaceholder = encodeURI(NUMBERS_PLACEHOLDER);

    if (urlTemplate.includes(NUMBERS_PLACEHOLDER)) {
        return NUMBERS_PLACEHOLDER;
    }

    if (urlTemplate.includes(encodedPlaceholder)) {
        return encodedPlaceholder;
    }

    return null;
}

function buildUrlTemplatePageNumberRegex(urlTemplate: string): RegExp | null {
    const placeholder = resolvePlaceholder(urlTemplate);
    if (placeholder == null) {
        return null;
    }

    const pattern = urlTemplate
        .split(placeholder)
        .map(escapeRegExp)
        .join("(\\d+)");

    return new RegExp(pattern);
}

/** Returns whether `urlTemplate` contains `{{NUMBER}}` (plain or URI-encoded). */
export function hasPageNumberPlaceholder(urlTemplate: string): boolean {
    return resolvePlaceholder(urlTemplate) != null;
}

/** Returns whether `urlTemplate` is a root-relative path or an absolute `http(s)` URL. */
export function isValidUrlTemplatePath(urlTemplate: string): boolean {
    return urlTemplate.startsWith("/") || /^https?:\/\//.test(urlTemplate);
}

/**
 * Normalizes a string shorthand to an object with `copyPageQueryParams: true`.
 */
export function normalizeUrlTemplate(input: UrlTemplate): UrlTemplateConfig {
    if (typeof input === "string") {
        return { template: input, copyPageQueryParams: true };
    }

    return {
        ...input,
        copyPageQueryParams: input.copyPageQueryParams ?? true,
    };
}

/**
 * Resolves authoring config to a path/absolute template and optional query snapshot.
 * A `query-param` source keeps the tab pathname and records `key` as `pageQueryParam`.
 * A `pathSuffix` builds a `{{NUMBER}}` template from the tab pathname.
 * Any other source resolves to a string that includes `{{NUMBER}}`.
 * Uses `document` (or `base`) when resolving a ValueSource.
 */
export function resolveUrlTemplate(
    input: UrlTemplate | null | undefined,
    base?: Document | null,
): ResolvedUrlTemplate | null {
    if (input == null) {
        return null;
    }

    const config = normalizeUrlTemplate(input);
    const queryParams = snapshotQueryParams(config.copyPageQueryParams !== false);

    if ("pathSuffix" in config) {
        const template = resolvePathSuffixTemplate(window.location.pathname, config.pathSuffix.trim());
        if (template == null || template.length === 0 || !hasPageNumberPlaceholder(template)) {
            return null;
        }

        return { template, queryParams };
    }

    if ("source" in config && config.source.source === "query-param") {
        const pageQueryParam = config.source.key.trim();
        if (pageQueryParam.length === 0) {
            return null;
        }

        return {
            template: window.location.pathname,
            queryParams,
            pageQueryParam,
        };
    }

    let template: string | null = null;

    if ("template" in config) {
        const value = config.template.trim();
        template = value.length > 0 ? value : null;
    } else if ("source" in config) {
        template = resolveValue(config.source, base ?? document);
    }

    if (template == null || template.length === 0 || !hasPageNumberPlaceholder(template)) {
        return null;
    }

    return { template, queryParams };
}

/**
 * Builds a `{{NUMBER}}` path from `pathname` and `suffix`.
 * Removes one trailing match of `suffix` and a leftover trailing slash, then appends `suffix`.
 * `/` and an empty base resolve to `suffix` itself.
 */
function resolvePathSuffixTemplate(pathname: string, suffix: string): string | null {
    const placeholder = resolvePlaceholder(suffix);
    if (placeholder == null || !suffix.startsWith("/")) {
        return null;
    }

    const matchBody = suffix.endsWith("/") ? suffix.slice(0, -1) : suffix;
    if (resolvePlaceholder(matchBody) == null) {
        return null;
    }

    const pattern = matchBody
        .split(placeholder)
        .map(escapeRegExp)
        .join("(\\d+)");
    const stripped = pathname.replace(new RegExp(`${pattern}/?$`), "");

    let base = stripped;
    if (base.length > 1 && base.endsWith("/")) {
        base = base.replace(/\/+$/, "");
    }

    if (base === "" || base === "/") {
        return suffix;
    }

    return `${base}${suffix}`;
}

function snapshotQueryParams(enabled: boolean): Record<string, string> {
    const queryParams: Record<string, string> = {};
    if (!enabled) {
        return queryParams;
    }

    new URL(window.location.href).searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });

    return queryParams;
}

/**
 * Reads `pageQueryParam` from `url` as an integer.
 * Relative URLs resolve against the current tab location.
 * @returns The parsed integer, or `null` when the parameter is missing or has no digits
 */
export function extractPageQueryParam(url: string, pageQueryParam: string): number | null {
    if (url.trim().length === 0 || pageQueryParam.trim().length === 0) {
        return null;
    }

    try {
        const raw = new URL(url, window.location.href).searchParams.get(pageQueryParam);
        return raw == null ? null : parseInteger(raw);
    } catch {
        return null;
    }
}

/**
 * Reads the page number from `url` using a resolved template.
 * Query-param templates read `pageQueryParam`. Other templates capture `{{NUMBER}}`.
 * @returns The parsed integer, or `null` when `url` does not contain it
 */
export function readPageNumberFromUrl(url: string, resolved: ResolvedUrlTemplate): number | null {
    if (resolved.pageQueryParam != null) {
        return extractPageQueryParam(url, resolved.pageQueryParam);
    }

    return extractPageNumberFromUrl(url, resolved.template);
}

/**
 * Extracts the page number captured by `{{NUMBER}}` in `urlTemplate` from `url`.
 * @returns The parsed integer, or `null` when the template has no placeholder or does not match
 */
export function extractPageNumberFromUrl(
    url: string,
    urlTemplate: string,
): number | null {
    const regex = buildUrlTemplatePageNumberRegex(urlTemplate);
    if (regex == null) {
        return null;
    }

    const match = url.match(regex);
    const captured = match?.[1];
    return captured != null ? parseInteger(captured) : null;
}

/** Substitutes `{{NUMBER}}` (plain or URI-encoded) in `urlTemplate` with `pageNumber`. */
export function applyPageNumberToTemplate(
    urlTemplate: string,
    pageNumber: number,
): string {
    const pageNumberLabel = pageNumber.toString();

    return urlTemplate
        .replaceAll(NUMBERS_PLACEHOLDER, pageNumberLabel)
        .replaceAll(encodeURI(NUMBERS_PLACEHOLDER), pageNumberLabel);
}

/**
 * Builds a paged URL from a resolved template.
 * Substitutes `{{NUMBER}}` when the template contains it, merges snapshotted query params,
 * then sets `pageQueryParam` to `pageNumber` so the fetched page overrides a copied value.
 */
export function buildPagedUrl(resolved: ResolvedUrlTemplate, pageNumber: number): string {
    const pathOrUrl = applyPageNumberToTemplate(resolved.template, pageNumber);

    if (Object.keys(resolved.queryParams).length === 0 && resolved.pageQueryParam == null) {
        return pathOrUrl;
    }

    const url = new URL(pathOrUrl, window.location.origin);
    for (const [key, value] of Object.entries(resolved.queryParams)) {
        url.searchParams.set(key, value);
    }
    if (resolved.pageQueryParam != null) {
        url.searchParams.set(resolved.pageQueryParam, pageNumber.toString());
    }

    if (pathOrUrl.startsWith("/") && !/^https?:\/\//.test(pathOrUrl)) {
        return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.toString();
}
