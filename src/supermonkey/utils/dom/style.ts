/**
 * Appends a `<style>` element to `document.head`.
 * When `css` is provided, sets it as the style text content.
 */
export function injectStyle(css?: string): HTMLStyleElement {
    if (css !== undefined && typeof css !== "string") {
        throw new Error("CSS must be a string.");
    }

    const style = document.createElement("style");
    if (css !== undefined) {
        style.textContent = css;
    }
    document.head.appendChild(style);
    return style;
}

/** Result of normalizing CSS that uses `&` as a selector placeholder. */
export type AmpersandCssSanitizeResult = {
    /** Trimmed CSS with every top-level selector containing `&`, or `""` when unusable. */
    readonly css: string;
    /** `true` when at least one selector was missing `&` and received a `& ` prefix. */
    readonly repairedSelectors: boolean;
};

/**
 * Normalizes CSS that uses `&` as a selector placeholder in every top-level rule.
 * Selectors missing `&` are repaired by prefixing `& ` (e.g. `&, foo` → `&, & foo`).
 */
export function sanitizeCssWithAmpersandPlaceholder(
    value: string | null | undefined,
): AmpersandCssSanitizeResult {
    if (value == null || typeof value !== "string") {
        return { css: "", repairedSelectors: false };
    }

    const text = value.trim();
    if (text.length === 0) {
        return { css: "", repairedSelectors: false };
    }

    const rules: { selector: string; body: string }[] = [];
    let repairedSelectors = false;

    const ok = forEachTopLevelCssRule(text, (selector, body) => {
        const parts = selector.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
        if (parts.length === 0) {
            return false;
        }

        const repairedParts = parts.map((part) => {
            if (part.includes("&")) {
                return part;
            }
            repairedSelectors = true;
            return `& ${part}`;
        });

        rules.push({ selector: repairedParts.join(", "), body });
        return true;
    });

    if (!ok || rules.length === 0) {
        return { css: "", repairedSelectors: false };
    }

    return {
        css: rules.map((rule) => `${rule.selector} {${rule.body}}`).join("\n"),
        repairedSelectors,
    };
}

/**
 * Replaces each `&` placeholder with `baseSelector` for stylesheet injection.
 */
export function expandCssAmpersandPlaceholder(css: string, baseSelector: string): string {
    return css.replaceAll("&", baseSelector);
}

/**
 * Walks top-level `selector { ... }` rules (brace-depth aware).
 * Returns `false` when the walk aborts or the string is not only complete rules.
 */
function forEachTopLevelCssRule(
    css: string,
    visit: (selector: string, body: string) => boolean,
): boolean {
    let i = 0;
    const n = css.length;

    while (i < n) {
        while (i < n && /\s/.test(css[i]!)) {
            i += 1;
        }
        if (i >= n) {
            break;
        }

        const selectorStart = i;
        let depth = 0;
        let openAt = -1;

        for (; i < n; i += 1) {
            const char = css[i]!;
            if (char === "{") {
                if (depth === 0) {
                    openAt = i;
                }
                depth += 1;
            } else if (char === "}") {
                depth -= 1;
                if (depth < 0) {
                    return false;
                }
                if (depth === 0 && openAt !== -1) {
                    const selector = css.slice(selectorStart, openAt).trim();
                    const body = css.slice(openAt + 1, i);
                    if (!visit(selector, body)) {
                        return false;
                    }
                    i += 1;
                    break;
                }
            }
        }

        if (openAt === -1 || depth !== 0) {
            return css.slice(selectorStart).trim().length === 0;
        }
    }

    return true;
}
