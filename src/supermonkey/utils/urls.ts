import { escapeRegExp } from "./regex";
import {
    splitAllowDenyPatterns,
    stripAllowDenyNegation,
} from "./allow-deny";

/**
 * Resolves `url` against `base` (defaults to the tab location) into an absolute href.
 * @throws When `url` is empty or not a valid URL
 */
export function normalizeUrl(url: string, base?: string): string {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
        throw new Error("URL must be non-empty");
    }

    try {
        return new URL(trimmed, base ?? window.location.href).href;
    } catch {
        throw new Error(`Invalid URL: "${url}"`);
    }
}

/** Like {@link normalizeUrl}, but returns `null` instead of throwing. */
export function tryNormalizeUrl(url: string, base?: string): string | null {
    try {
        return normalizeUrl(url, base);
    } catch {
        return null;
    }
}

function matchesGlob(value: string, pattern: string): boolean {
    const trimmed = pattern.trim();
    if (trimmed.length === 0) {
        return false;
    }

    try {
        return globToRegExp(trimmed).test(value);
    } catch {
        return false;
    }
}

/**
 * Whether a pathname glob is usable for mapped-page `paths`.
 * Accepts optional `!!` negation; the pattern body after strip must be non-empty. `*` matches any substring.
 */
export function isValidPathPattern(pattern: string): boolean {
    return stripAllowDenyNegation(pattern).length > 0;
}

/**
 * Whether a domain pattern is specific enough for matching.
 * Rejects bare `*`, globs with only a TLD under them (`*.com`), and globs after the TLD (`example.com.*`).
 * Optional `!!` negation prefix is ignored for the check.
 */
export function isValidDomainPattern(domain: string): boolean {
    const pattern = stripAllowDenyNegation(domain).toLowerCase();

    if (pattern.length === 0 || pattern === "*") {
        return false;
    }

    const labels = pattern.split(".");
    if (labels.some((label) => label.length === 0)) {
        return false;
    }

    const tld = labels[labels.length - 1];
    if (tld.includes("*")) {
        return false;
    }

    const labelsAboveTld = labels.slice(0, -1);
    return labelsAboveTld.some((label) => !isGlobOnlyLabel(label));
}

function isGlobOnlyLabel(label: string): boolean {
    return label.length > 0 && [...label].every((char) => char === "*");
}

/**
 * Case-insensitive glob match of a hostname against a single domain pattern.
 * `*` matches any substring.
 */
function hostnameMatchesDomain(hostname: string, domain: string): boolean {
    return matchesGlob(hostname.toLowerCase(), domain.toLowerCase());
}

/**
 * Matches a value against a pattern list with optional `!!` negations.
 * Requires at least one positive match and no matching negation.
 */
function matchesAllowDenyList(
    value: string,
    patterns: readonly string[],
    matchOne: (value: string, pattern: string) => boolean,
): boolean {
    const { positives, negatives } = splitAllowDenyPatterns(patterns);

    if (positives.length === 0) {
        return false;
    }

    if (!positives.some((pattern) => matchOne(value, pattern))) {
        return false;
    }

    if (negatives.some((pattern) => matchOne(value, pattern))) {
        return false;
    }

    return true;
}

/**
 * Whether `pathname` matches a single mapped-page path glob (body after optional `!!`).
 * Invalid patterns are ignored. Matching is case-sensitive; `*` matches any substring.
 */
export function pathnameMatchesPath(pathname: string, pattern: string): boolean {
    if (!isValidPathPattern(pattern)) {
        return false;
    }

    return matchesGlob(pathname, stripAllowDenyNegation(pattern));
}

/**
 * Whether `pathname` matches a path list with optional `!!` negations.
 * Invalid patterns are ignored. Requires at least one positive match and no matching negation.
 */
export function pathnameMatchesPaths(
    pathname: string,
    paths: readonly string[],
): boolean {
    return matchesAllowDenyList(
        pathname,
        paths.filter(isValidPathPattern),
        (value, pattern) => matchesGlob(value, pattern),
    );
}

/**
 * Whether `hostname` matches a domain list with optional `!!` negations.
 * Invalid domain patterns are ignored. Requires at least one positive match and no matching negation.
 */
export function hostnameMatchesDomains(
    hostname: string,
    domains: readonly string[],
): boolean {
    return matchesAllowDenyList(
        hostname,
        domains.filter(isValidDomainPattern),
        hostnameMatchesDomain,
    );
}

function globToRegExp(pattern: string): RegExp {
    let result = "";
    for (const char of pattern) {
        if (char === "*") {
            result += ".*";
            continue;
        }
        result += escapeRegExp(char);
    }
    return new RegExp(`^${result}$`);
}
