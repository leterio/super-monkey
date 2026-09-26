import { queryAll, type QueryableBaseElement } from "../../utils/dom/query";

/**
 * Resolves shadow roots from a Custom CSS shadow selector chain.
 *
 * - Splits on commas into independent selectors.
 * - Each selector must end with `:shadowRoot` (optional space before the token).
 * - Empty query before `:shadowRoot` uses the current base element (no `querySelector`).
 * - Nested chains enter each matched host's `shadowRoot` before the next query.
 */
export function queryShadowRoots(
    selector: string,
    base: ParentNode,
): ShadowRoot[] {
    const trimmed = selector.trim();
    if (trimmed.length === 0) {
        return [];
    }

    const results: ShadowRoot[] = [];
    for (const part of splitTopLevelSelectors(trimmed)) {
        for (const root of resolveOneSelector(part, base)) {
            if (!results.includes(root)) {
                results.push(root);
            }
        }
    }
    return results;
}

function splitTopLevelSelectors(selector: string): string[] {
    return selector.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

function resolveOneSelector(selector: string, base: ParentNode): ShadowRoot[] {
    if (!selector.includes(":shadowRoot")) {
        return [];
    }

    const segments = selector.split(/\s*:shadowRoot\b/);
    const trailing = segments[segments.length - 1] ?? "";
    if (trailing.trim().length > 0) {
        // Must end with :shadowRoot (trailing query without entering a shadow is invalid).
        return [];
    }

    const steps = segments.slice(0, -1);
    if (steps.length === 0) {
        return [];
    }

    let contexts: ParentNode[] = [base];

    for (let index = 0; index < steps.length; index++) {
        const queryPart = steps[index]!.trim();
        const nextRoots: ShadowRoot[] = [];

        for (const context of contexts) {
            const hosts = resolveHosts(queryPart, context);
            for (const host of hosts) {
                if (host.shadowRoot != null) {
                    nextRoots.push(host.shadowRoot);
                }
            }
        }

        if (index === steps.length - 1) {
            return nextRoots;
        }

        contexts = nextRoots;
    }

    return [];
}

function resolveHosts(queryPart: string, context: ParentNode): Element[] {
    if (queryPart.length === 0) {
        return context instanceof Element ? [context] : [];
    }

    if (
        context instanceof HTMLElement
        || context instanceof Document
        || context instanceof ShadowRoot
    ) {
        return queryAll(queryPart, context as QueryableBaseElement);
    }

    return [];
}
