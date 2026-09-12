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

/** Builds the template string from a ValueSource (document/tab as context). */
export type UrlTemplateSourceConfig = {
    readonly source: ValueSource;
    /** When not `false`, copies the current tab query string onto built page URLs (default `true`). */
    readonly copyPageQueryParams?: boolean;
};

/** Object form: exactly one of `template` or `source`. */
export type UrlTemplateConfig = UrlTemplateStaticConfig | UrlTemplateSourceConfig;

/** Authoring shape: string shorthand or object config. */
export type UrlTemplate = string | UrlTemplateConfig;

/** Snapshot used when building numbered page URLs. */
export type ResolvedUrlTemplate = {
    /** Path or absolute URL that still contains `{{NUMBER}}`. */
    readonly template: string;
    /** Query params snapshotted from the live tab when `copyPageQueryParams` is enabled. */
    readonly queryParams: Record<string, string>;
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
    let template: string | null = null;

    if ("template" in config) {
        const value = config.template.trim();
        template = value.length > 0 ? value : null;
    } else {
        template = resolveValue(config.source, base ?? document);
    }

    if (template == null || template.length === 0 || !hasPageNumberPlaceholder(template)) {
        return null;
    }

    const queryParams: Record<string, string> = {};
    if (config.copyPageQueryParams !== false) {
        new URL(window.location.href).searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });
    }

    return { template, queryParams };
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
 * Builds a paged URL from a resolved template: substitutes `{{NUMBER}}`, then merges snapshotted query params.
 */
export function buildPagedUrl(resolved: ResolvedUrlTemplate, pageNumber: number): string {
    const pathOrUrl = applyPageNumberToTemplate(resolved.template, pageNumber);

    if (Object.keys(resolved.queryParams).length === 0) {
        return pathOrUrl;
    }

    const url = new URL(pathOrUrl, window.location.origin);
    for (const [key, value] of Object.entries(resolved.queryParams)) {
        url.searchParams.set(key, value);
    }

    if (pathOrUrl.startsWith("/") && !/^https?:\/\//.test(pathOrUrl)) {
        return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.toString();
}
