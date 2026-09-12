import { trimArray } from "../arrays";
import { OptsNormalization } from "./normalization";

/** Options for {@link readStringList}. */
export type ReadStringListOptions = {
    /** When true, missing or empty lists collect a repair finding. */
    readonly required?: boolean;
    /** Field noun used in messages (for example `selectors`, `attributes`). */
    readonly label?: string;
    /**
     * Behavior when a present list trims to empty and `required` is false.
     * `omit` returns `undefined` without a finding; `repair` reports and returns `undefined`.
     */
    readonly onEmpty?: "omit" | "repair";
};

/**
 * Reads a list of trimmed non-empty strings from opts.
 * Non-arrays collect a repair finding. Empty/non-string entries are ignored.
 */
export function readStringList(
    raw: unknown,
    path: string,
    walk: OptsNormalization,
    options: ReadStringListOptions = {},
): string[] | undefined {
    const required = options.required === true;
    const onEmpty = options.onEmpty ?? "omit";
    const label = options.label;

    if (raw == null) {
        if (required) {
            walk.repair(path, requiredMessage(label));
        }
        return undefined;
    }

    if (!Array.isArray(raw)) {
        walk.repair(path, arrayMessage(label));
        return undefined;
    }

    const entries = trimArray(raw);

    if (entries.length === 0) {
        if (required) {
            walk.repair(path, requiredMessage(label));
        } else if (onEmpty === "repair") {
            walk.repair(path, emptyMessage(label));
        }
        return undefined;
    }

    if (entries.length !== raw.length) {
        walk.repair(path, "ignored empty or non-string entries");
    }

    return entries;
}

/**
 * Reads an optional finite number from opts.
 * Non-finite values collect a repair finding and return `undefined`.
 */
export function readOptionalFiniteNumber(
    value: unknown,
    path: string,
    walk: OptsNormalization,
): number | undefined {
    if (value == null) {
        return undefined;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    walk.repair(path, "must be a finite number");
    return undefined;
}

function requiredMessage(label: string | undefined): string {
    return label != null ? `${label} is required` : "is required";
}

function arrayMessage(label: string | undefined): string {
    return label != null ? `${label} must be an array` : "must be an array";
}

function emptyMessage(label: string | undefined): string {
    return label != null ? `no usable ${label}` : "no usable entries";
}
