import { trimArray } from "./arrays";

/** Escapes special regex characters in a literal string. */
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compiles a RegExp from `value`, or returns `null` when the pattern is invalid. */
export function safeCompileRegExp(value: string): RegExp | null {
    try {
        return new RegExp(value);
    } catch {
        return null;
    }
}

/** Extracts a capture from the first matching regex. */
type RegexExtract = {
    readonly type: "extract";
    readonly captureGroup?: number;
};

/** Replaces the first matching regex with a replacement string. */
type RegexReplace = {
    readonly type: "replace";
    readonly replacement: string;
};

/**
 * Optional regex post-processing applied to a resolved string.
 * Tries `regexes` in order; the first successful match wins.
 */
export type RegexMapper = {
    readonly regexes: string[];
} & (RegexExtract | RegexReplace);

function extractRegex(value: string, regexes: string[], group: number): string | null {
    for (const pattern of trimArray(regexes)) {
        const regex = safeCompileRegExp(pattern);
        if (regex == null) {
            continue;
        }

        const match = value.match(regex);
        if (match == null) {
            continue;
        }

        const captured = match[group] ?? match[0];
        if (captured != null && captured.length > 0) {
            return captured;
        }
    }

    return null;
}

function replaceRegex(value: string, regexes: string[], replacement: string): string | null {
    for (const pattern of trimArray(regexes)) {
        const regex = safeCompileRegExp(pattern);
        if (regex == null || value.match(regex) == null) {
            continue;
        }
        const replaced = value.replace(regex, replacement);
        return replaced.length > 0 ? replaced : null;
    }
    return null;
}

/**
 * Applies `mapper` to `value`.
 * Returns `null` when no regex succeeds or the result is empty.
 */
export function applyRegexMapper(value: string, mapper: RegexMapper): string | null {
    switch (mapper.type) {
        case "extract": {
            return extractRegex(value, mapper.regexes, mapper.captureGroup ?? 1);
        }
        case "replace": {
            return replaceRegex(value, mapper.regexes, mapper.replacement);
        }
        default: {
            return null;
        }
    }
}
