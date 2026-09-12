/**
 * Normalizes an array to non-empty trimmed strings.
 * Non-string entries are skipped.
 */
export function trimArray(value: readonly unknown[] | null | undefined): string[] {
    if (value == null) {
        return [];
    }

    const items: string[] = [];
    for (const item of value) {
        if (typeof item !== "string") {
            continue;
        }

        const trimmed = item.trim();
        if (trimmed.length > 0) {
            items.push(trimmed);
        }
    }

    return items;
}
