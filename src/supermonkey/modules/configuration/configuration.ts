import { getValue, setValue, watch, type ValueChangeHandler, type ValueWatcher } from "../../utils/value";
import { isValidComposedId, isValidId, mergeIds } from "../../utils/string";
import type { Action } from "./action";

export type Configuration = AbstractConfiguration<any> | Action;

export type ConfigurationOpts = {
    readonly label?: string;
    readonly description?: string;
};

/**
 * Stored preference owned by a module instance.
 * Storage key: `{moduleName}::{settingKey}`.
 * `moduleName` is already `{integration}::{instance}`.
 */
export abstract class AbstractConfiguration<TYPE> {
    readonly key: string;

    constructor(
        moduleName: string,
        key: string,
        readonly defaultValue: TYPE,
        readonly opts?: ConfigurationOpts,
    ) {
        this.key = AbstractConfiguration.buildKey(moduleName, key);
    }

    get value(): TYPE {
        return getValue(this.key, this.defaultValue);
    }

    set value(value: TYPE | null) {
        if (value != null && !this.isValid(value)) {
            throw new Error("Invalid value");
        }

        setValue(this.key, value);
    }

    watch(handler: ValueChangeHandler<TYPE>): ValueWatcher {
        return watch(this.key, this.defaultValue, handler);
    }

    abstract isValid(value: TYPE | null): boolean;

    protected assertValidDefault(): void {
        if (!this.isValid(this.defaultValue)) {
            throw new Error("Invalid default value");
        }
    }

    private static buildKey(moduleName: string, key: string): string {
        if (!isValidComposedId(moduleName)) {
            throw new Error("Module name is required");
        }

        if (!isValidId(key)) {
            throw new Error("Invalid configuration key");
        }

        const fullKey = mergeIds(moduleName, key);

        if (!isValidComposedId(fullKey)) {
            throw new Error("Invalid configuration key");
        }

        return fullKey;
    }
}
