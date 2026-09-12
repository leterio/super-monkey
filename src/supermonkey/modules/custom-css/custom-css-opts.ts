import { Normalized, OptsNormalization } from "../../utils/opts/normalization";
import { readOptionalFiniteNumber } from "../../utils/opts/opts-fields";
import { isValidId, trimToUndefined } from "../../utils/string";
import { isPlainObject } from "../../utils/type";
import type { ModuleOpts } from "../module";

export type CustomCssOption = {
    readonly label: string;
    readonly value: string;
};

type CustomCssRuleBase = {
    readonly key: string;
    readonly css: string;
    readonly label?: string;
    readonly description?: string;
};

export type CustomCssBooleanRule = CustomCssRuleBase & {
    readonly type: "boolean";
    readonly defaultValue?: boolean;
};

export type CustomCssNumberRule = CustomCssRuleBase & {
    readonly type: "number";
    readonly min?: number;
    readonly max?: number;
    readonly defaultValue?: number;
};

export type CustomCssOptionsRule = CustomCssRuleBase & {
    readonly type: "options";
    readonly options: readonly CustomCssOption[];
    readonly defaultValue?: string;
};

export type CustomCssRule =
    | CustomCssBooleanRule
    | CustomCssNumberRule
    | CustomCssOptionsRule;

export type CustomCssOpts = ModuleOpts & {
    readonly static?: string;
    readonly rules?: readonly CustomCssRule[];
};

/**
 * Normalizes CustomCss opts before load.
 * Unusable rules are dropped as repairs; no static CSS and no usable rules omit `value`.
 */
export function normalizeCustomCssOpts(raw: unknown): Normalized<CustomCssOpts> {
    const walk = new OptsNormalization();

    if (!isPlainObject(raw)) {
        walk.reject("opts", "options must be an object");
        return walk.finish<CustomCssOpts>(undefined);
    }

    const staticCss = normalizeStatic(raw.static, walk);
    const rules = normalizeRules(raw.rules, walk);

    if (staticCss == null && rules.length === 0) {
        walk.reject(
            "opts",
            "a non-empty static CSS string and/or at least one usable rule is required",
        );
        return walk.finish<CustomCssOpts>(undefined);
    }

    return walk.finish({
        ...(staticCss != null ? { static: staticCss } : {}),
        ...(rules.length > 0 ? { rules } : {}),
    });
}

function normalizeStatic(raw: unknown, walk: OptsNormalization): string | undefined {
    if (raw == null) {
        return undefined;
    }

    if (typeof raw !== "string") {
        walk.repair("static", "static must be a string");
        return undefined;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    return trimmed;
}

function normalizeRules(raw: unknown, walk: OptsNormalization): CustomCssRule[] {
    if (raw == null) {
        return [];
    }

    if (!Array.isArray(raw)) {
        walk.repair("rules", "rules must be an array");
        return [];
    }

    const rules: CustomCssRule[] = [];
    const seenKeys = new Set<string>();

    raw.forEach((entry, index) => {
        const path = `rules[${index}]`;
        const normalized = normalizeRule(entry, path, seenKeys, walk);
        if (normalized != null) {
            rules.push(normalized);
        }
    });

    return rules;
}

function normalizeRule(
    raw: unknown,
    path: string,
    seenKeys: Set<string>,
    walk: OptsNormalization,
): CustomCssRule | undefined {
    if (!isPlainObject(raw)) {
        walk.repair(path, "rule must be an object");
        return undefined;
    }

    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    if (!isValidId(key)) {
        walk.repair(`${path}.key`, "key must be a valid id segment");
        return undefined;
    }

    if (seenKeys.has(key)) {
        walk.repair(`${path}.key`, `duplicate rule key ignored: ${key}`);
        return undefined;
    }

    const css = typeof raw.css === "string" ? raw.css : "";
    if (css.trim().length === 0) {
        walk.repair(`${path}.css`, "css must be a non-empty string");
        return undefined;
    }

    const type = raw.type;
    if (type !== "boolean" && type !== "number" && type !== "options") {
        walk.repair(`${path}.type`, "type must be boolean, number, or options");
        return undefined;
    }

    seenKeys.add(key);

    const label = trimToUndefined(raw.label);
    const description = trimToUndefined(raw.description);

    const base = {
        key,
        css,
        ...(label != null ? { label } : {}),
        ...(description != null ? { description } : {}),
    };

    switch (type) {
        case "boolean":
            return normalizeBooleanRule(raw, path, base, walk);
        case "number":
            return normalizeNumberRule(raw, path, base, walk);
        case "options":
            return normalizeOptionsRule(raw, path, base, walk);
    }
}

function normalizeBooleanRule(
    raw: Record<string, unknown>,
    path: string,
    base: CustomCssRuleBase,
    walk: OptsNormalization,
): CustomCssBooleanRule {
    let defaultValue: boolean | undefined;
    if (raw.defaultValue == null) {
        defaultValue = undefined;
    } else if (typeof raw.defaultValue === "boolean") {
        defaultValue = raw.defaultValue;
    } else {
        walk.repair(`${path}.defaultValue`, "defaultValue must be a boolean; using true");
        defaultValue = true;
    }

    return {
        type: "boolean",
        ...base,
        ...(defaultValue != null ? { defaultValue } : {}),
    };
}

function normalizeNumberRule(
    raw: Record<string, unknown>,
    path: string,
    base: CustomCssRuleBase,
    walk: OptsNormalization,
): CustomCssNumberRule {
    let defaultValue: number | undefined;
    if (raw.defaultValue == null) {
        defaultValue = undefined;
    } else if (typeof raw.defaultValue === "number" && Number.isFinite(raw.defaultValue)) {
        defaultValue = raw.defaultValue;
    } else {
        walk.repair(`${path}.defaultValue`, "defaultValue must be a finite number; using 0");
        defaultValue = 0;
    }

    const min = readOptionalFiniteNumber(raw.min, `${path}.min`, walk);
    const max = readOptionalFiniteNumber(raw.max, `${path}.max`, walk);

    return {
        type: "number",
        ...base,
        ...(defaultValue != null ? { defaultValue } : {}),
        ...(min != null ? { min } : {}),
        ...(max != null ? { max } : {}),
    };
}

function normalizeOptionsRule(
    raw: Record<string, unknown>,
    path: string,
    base: CustomCssRuleBase,
    walk: OptsNormalization,
): CustomCssOptionsRule | undefined {
    if (!Array.isArray(raw.options)) {
        walk.repair(`${path}.options`, "options must be a non-empty array");
        return undefined;
    }

    const options: CustomCssOption[] = [];
    raw.options.forEach((entry, index) => {
        const optionPath = `${path}.options[${index}]`;
        if (!isPlainObject(entry)) {
            walk.repair(optionPath, "option must be an object");
            return;
        }

        const optionLabel = typeof entry.label === "string" ? entry.label.trim() : "";
        const optionValue = typeof entry.value === "string" ? entry.value.trim() : "";
        if (optionLabel.length === 0 || optionValue.length === 0) {
            walk.repair(optionPath, "option needs non-empty label and value");
            return;
        }

        options.push({ label: optionLabel, value: optionValue });
    });

    if (options.length === 0) {
        walk.repair(`${path}.options`, "no usable options");
        return undefined;
    }

    const values = options.map((option) => option.value);
    let defaultValue: string | undefined;
    if (raw.defaultValue == null) {
        defaultValue = undefined;
    } else if (typeof raw.defaultValue === "string" && values.includes(raw.defaultValue)) {
        defaultValue = raw.defaultValue;
    } else {
        walk.repair(
            `${path}.defaultValue`,
            "defaultValue must match an option value; using the first option",
        );
        defaultValue = values[0];
    }

    return {
        type: "options",
        ...base,
        options,
        ...(defaultValue != null ? { defaultValue } : {}),
    };
}
