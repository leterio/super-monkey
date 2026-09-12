import {
    GM_addValueChangeListener,
    GM_deleteValue,
    GM_getValue,
    GM_listValues,
    GM_removeValueChangeListener,
    GM_setValue,
} from "$";
import { isValidComposedId, mergeIds, normalizeId } from "./string";

/** Callback for {@link watch} when a stored value changes. */
export type ValueChangeHandler<TYPE> = (
    oldValue: TYPE | null | undefined,
    newValue: TYPE,
    remote: boolean,
) => void;

/** Handle returned by {@link watch}; call `unwatch` to stop listening. */
export type ValueWatcher = {
    unwatch(): void;
};

function assertComposedKey(key: string, context: string): void {
    if (!isValidComposedId(key)) {
        throw new Error(`${context} key is invalid`);
    }
}

/**
 * Reads a Tampermonkey stored value.
 * @template TYPE - Stored value shape
 * @param key - Composed id (`segment` or `segment::segment`)
 * @param defaultValue - Returned when the key is unset
 * @throws When the key is not a valid composed id
 */
export function getValue<TYPE>(
    key: string,
    defaultValue: TYPE,
): TYPE {
    assertComposedKey(key, "Getter");

    return GM_getValue<TYPE>(key, defaultValue);
}

/**
 * Writes or deletes a Tampermonkey stored value.
 * Pass `null` or `undefined` to delete the key.
 * @template TYPE - Stored value shape
 * @param key - Composed id (`segment` or `segment::segment`)
 * @throws When the key is not a valid composed id
 */
export function setValue<TYPE>(key: string, value: TYPE | null | undefined): void {
    assertComposedKey(key, "Setter");

    if (value == null) {
        GM_deleteValue(key);
        return;
    }

    GM_setValue(key, value);
}

/**
 * Watches a Tampermonkey stored value for changes.
 * @template TYPE - Stored value shape
 * @param key - Composed id (`segment` or `segment::segment`)
 * @param defaultValue - Used when the stored value is cleared
 * @param handler - Invoked with old value, resolved new value, and whether the change is remote
 * @throws When the key is not a valid composed id or `handler` is not a function
 */
export function watch<TYPE>(
    key: string,
    defaultValue: TYPE,
    handler: ValueChangeHandler<TYPE>,
): ValueWatcher {
    assertComposedKey(key, "Watcher");

    if (typeof handler !== "function") {
        throw new Error("Watcher handler must be a function");
    }

    const watcherId = GM_addValueChangeListener<TYPE>(
        key,
        (name, oldValue, newValue, remote) => {
            if (name !== key) {
                return;
            }

            const resolvedNew = newValue != null ? newValue : defaultValue;
            handler(oldValue, resolvedNew, remote ?? false);
        },
    );

    let active = true;

    return {
        unwatch: () => {
            if (!active) {
                return;
            }
            active = false;
            GM_removeValueChangeListener(watcherId);
        },
    };
}

/** Lists every Tampermonkey storage key for this script. */
export function listKeys(): string[] {
    return GM_listValues();
}

/** Lists storage keys that start with `prefix`. */
export function listKeysWithPrefix(prefix: string): string[] {
    return listKeys().filter((key) => key.startsWith(prefix));
}

/** Storage key prefix for an integration's config values (`name::`). */
export function integrationConfigKeyPrefix(integrationName: string): string {
    return `${normalizeId(integrationName)}::`;
}

/** Storage key prefix for a module's config under an integration. */
export function moduleConfigKeyPrefix(integrationName: string, moduleName: string): string {
    return `${mergeIds(normalizeId(integrationName), normalizeId(moduleName))}::`;
}

/** Deletes all Tampermonkey keys under the integration config prefix. */
export function deleteIntegrationConfigKeys(integrationName: string): void {
    for (const key of listKeysWithPrefix(integrationConfigKeyPrefix(integrationName))) {
        GM_deleteValue(key);
    }
}

/** Deletes all Tampermonkey keys under the module config prefix. */
export function deleteModuleConfigKeys(integrationName: string, moduleName: string): void {
    for (const key of listKeysWithPrefix(moduleConfigKeyPrefix(integrationName, moduleName))) {
        GM_deleteValue(key);
    }
}

/**
 * Moves module config keys from `fromModule` to `toModule` under the same integration.
 * No-op when the module names are equal.
 * @throws When a rename target key is not a valid composed id
 */
export function renameModuleConfigKeys(
    integrationName: string,
    fromModule: string,
    toModule: string,
): void {
    if (fromModule === toModule) {
        return;
    }

    const fromPrefix = moduleConfigKeyPrefix(integrationName, fromModule);
    const toPrefix = moduleConfigKeyPrefix(integrationName, toModule);
    for (const key of listKeysWithPrefix(fromPrefix)) {
        const newKey = `${toPrefix}${key.slice(fromPrefix.length)}`;
        assertComposedKey(newKey, "Rename target");
        GM_setValue(newKey, GM_getValue(key));
        GM_deleteValue(key);
    }
}
