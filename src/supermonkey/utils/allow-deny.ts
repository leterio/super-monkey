const ALLOW_DENY_NEGATION_PREFIX = "!!";

type AllowDenySplit = {
    readonly positives: string[];
    readonly negatives: string[];
};

/**
 * Splits patterns into positives and negatives.
 * Negatives are returned without the `!!` prefix. Empty / blank entries are skipped.
 */
export function splitAllowDenyPatterns(patterns: readonly string[]): AllowDenySplit {
    const positives: string[] = [];
    const negatives: string[] = [];

    for (const raw of patterns) {
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
            continue;
        }

        if (trimmed.startsWith(ALLOW_DENY_NEGATION_PREFIX)) {
            const negated = trimmed.slice(ALLOW_DENY_NEGATION_PREFIX.length).trim();
            if (negated.length > 0) {
                negatives.push(negated);
            }
            continue;
        }

        positives.push(trimmed);
    }

    return { positives, negatives };
}

/**
 * Trims a pattern and normalizes `!!` spacing (`!!  foo` → `!!foo`).
 * Returns `undefined` when the result would be empty.
 */
export function normalizeAllowDenyPattern(pattern: string): string | undefined {
    const trimmed = pattern.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    if (trimmed.startsWith(ALLOW_DENY_NEGATION_PREFIX)) {
        const negated = trimmed.slice(ALLOW_DENY_NEGATION_PREFIX.length).trim();
        if (negated.length === 0) {
            return undefined;
        }
        return `${ALLOW_DENY_NEGATION_PREFIX}${negated}`;
    }

    return trimmed;
}

/**
 * Returns the pattern body without a leading `!!` (trimmed).
 */
export function stripAllowDenyNegation(pattern: string): string {
    const trimmed = pattern.trim();
    if (trimmed.startsWith(ALLOW_DENY_NEGATION_PREFIX)) {
        return trimmed.slice(ALLOW_DENY_NEGATION_PREFIX.length).trim();
    }
    return trimmed;
}

/**
 * Whether at least one entry is a non-empty positive (non-`!!`) pattern.
 */
export function hasPositiveAllowDenyPattern(patterns: readonly string[]): boolean {
    return patterns.some((pattern) => {
        const trimmed = pattern.trim();
        return trimmed.length > 0 && !trimmed.startsWith(ALLOW_DENY_NEGATION_PREFIX);
    });
}
