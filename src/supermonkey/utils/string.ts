const ID_SEGMENT = /^[A-Za-z0-9_-]+$/;

/** Separator for composed ids (`segment::segment`). */
export const ID_SEPARATOR = "::";

/**
 * Normalizes a string into a storage id segment (`[A-Za-z0-9_-]+`).
 * Non-matching characters become `_`.
 */
export function normalizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * Whether `value` is a single valid id segment (`[A-Za-z0-9_-]+`).
 */
export function isValidId(value: string): boolean {
    return typeof value === "string"
        && value.length > 0
        && ID_SEGMENT.test(value);
}

/**
 * Whether `value` is a Tampermonkey storage key of one or more `::`-separated id segments.
 */
export function isValidComposedId(value: string): boolean {
    if (typeof value !== "string" || value.length === 0) {
        return false;
    }

    const segments = value.split(ID_SEPARATOR);
    if (segments.length === 0) {
        return false;
    }

    return segments.every((segment) => isValidId(segment));
}

/**
 * Joins id segments with {@link ID_SEPARATOR}.
 * Each part may be a single id or an already-composed id.
 * @throws When no parts are given, or a part is missing, empty, or not a valid composed id
 */
export function mergeIds(...parts: Array<string | null | undefined>): string {
    if (parts.length === 0) {
        throw new Error("mergeIds requires at least one part");
    }

    const segments: string[] = [];
    for (const part of parts) {
        if (part == null || typeof part !== "string" || part.length === 0) {
            throw new Error("mergeIds part must be a non-empty string");
        }
        if (!isValidComposedId(part)) {
            throw new Error(`mergeIds part is not a valid id: ${part}`);
        }
        segments.push(...part.split(ID_SEPARATOR));
    }

    return segments.join(ID_SEPARATOR);
}

/**
 * Returns a short random alphanumeric string of the requested length.
 */
export function randomString(length: number): string {
    return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Returns a trimmed non-empty string, or `undefined` when the value is not a usable string.
 */
export function trimToUndefined(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Splits `value` on newlines into trimmed non-empty lines.
 * @returns An empty array when `value` is nullish
 */
export function splitLines(value: string | null | undefined): string[] {
    if (value == null) {
        return [];
    }

    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/** Joins lines with `\n`; nullish input becomes an empty string. */
export function joinLines(value: readonly string[] | null | undefined): string {
    return value?.join("\n") ?? "";
}

/**
 * Splits a comma-separated list into trimmed non-empty tokens.
 */
export function splitCsv(value: string | null | undefined): string[] {
    if (value == null) {
        return [];
    }

    return value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * Joins tokens with `, ` for comma-separated draft fields.
 */
export function joinCsv(value: readonly string[] | null | undefined): string {
    return value?.join(", ") ?? "";
}

/**
 * Replaces `{{token}}` placeholders in `template` with values from `tokens`.
 * Unknown tokens are left unchanged.
 */
export function fillTokens(
    template: string,
    tokens: Record<string, string>,
): string {
    if (template == null) {
        return "";
    }

    if (tokens == null) {
        return template;
    }

    return template.replace(
        /\{\{(\w+)\}\}/g,
        (_, token: string) => tokens[token] != null ? tokens[token] : `{{${token}}}`,
    );
}
