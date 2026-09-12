import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { isValidId, trimToUndefined } from "../../utils/string";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";

/** Lifecycle or Content Manager hook that runs a JS snippet. */
export type JsSnippetListener =
    | "contentLoaded"
    | "beforeUnload"
    | "entityViewed"
    | "entitiesParsed"
    | "entitiesInjected";

const LISTENERS: readonly JsSnippetListener[] = [
    "contentLoaded",
    "beforeUnload",
    "entityViewed",
    "entitiesParsed",
    "entitiesInjected",
];

/**
 * One opt-in snippet bound to a single listener.
 * `name` is the Configuration Menu storage key.
 */
export type JsSnippetRule = {
    readonly name: string;
    readonly label: string;
    readonly description?: string;
    readonly listener: JsSnippetListener;
    readonly code: string;
};

/** Options for {@link JsSnippets}. */
export type JsSnippetsOpts = ModuleOpts & {
    readonly rules: readonly JsSnippetRule[];
};

/**
 * Normalizes JsSnippets opts before load.
 * Unusable rules are dropped as repairs; no usable rules omit `value`.
 */
export function normalizeJsSnippetsOpts(raw: unknown): Normalized<JsSnippetsOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<JsSnippetsOpts>(undefined);
    }

    const rules = normalizeRules(raw.rules, walk);

    if (rules.length === 0) {
        walk.reject("opts", "at least one usable rule is required");
        return walk.finish<JsSnippetsOpts>(undefined);
    }

    return walk.finish({ rules });
}

function normalizeRules(raw: unknown, walk: OptsNormalization): JsSnippetRule[] {
    if (raw == null) {
        return [];
    }

    if (!Array.isArray(raw)) {
        walk.repair("rules", "rules must be an array");
        return [];
    }

    const rules: JsSnippetRule[] = [];
    const seenNames = new Set<string>();

    raw.forEach((entry, index) => {
        const path = `rules[${index}]`;
        const normalized = normalizeRule(entry, path, seenNames, walk);
        if (normalized != null) {
            rules.push(normalized);
        }
    });

    return rules;
}

function normalizeRule(
    raw: unknown,
    path: string,
    seenNames: Set<string>,
    walk: OptsNormalization,
): JsSnippetRule | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "rule must be an object");
        return undefined;
    }

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!isValidId(name)) {
        walk.repair(`${path}.name`, "name must be a valid id segment");
        return undefined;
    }

    if (seenNames.has(name)) {
        walk.repair(`${path}.name`, `duplicate rule name ignored: ${name}`);
        return undefined;
    }

    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    if (label.length === 0) {
        walk.repair(`${path}.label`, "label must be a non-empty string");
        return undefined;
    }

    if (!isJsSnippetListener(raw.listener)) {
        walk.repair(
            `${path}.listener`,
            "listener must be contentLoaded, beforeUnload, entityViewed, entitiesParsed, or entitiesInjected",
        );
        return undefined;
    }

    const code = typeof raw.code === "string" ? raw.code.trim() : "";
    if (code.length === 0) {
        walk.repair(`${path}.code`, "code must be a non-empty string");
        return undefined;
    }

    seenNames.add(name);

    const description = trimToUndefined(raw.description);

    return {
        name,
        label,
        listener: raw.listener,
        code,
        ...(description != null ? { description } : {}),
    };
}

function isJsSnippetListener(value: unknown): value is JsSnippetListener {
    return typeof value === "string" && (LISTENERS as readonly string[]).includes(value);
}
