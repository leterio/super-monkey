# Value storage

Typed Tampermonkey storage helpers in `src/supermonkey/utils/value.ts`. Keys are composed ids (`segment` or `segment::segment`).

| Function                         | Behavior                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| `getValue(key, defaultValue)`    | Returns the stored value, or `defaultValue` when unset.                  |
| `setValue(key, value)`           | Writes `value`. `null` or `undefined` deletes the key.                   |
| `watch(key, defaultValue, handler)` | Invokes `handler(oldValue, newValue, remote)` on change. Cleared values resolve to `defaultValue`. Returns `{ unwatch() }`. |
| `listKeys()`                     | Every Tampermonkey storage key for this script.                          |
| `listKeysWithPrefix(prefix)`     | Keys that start with `prefix`.                                           |
| `integrationConfigKeyPrefix(name)` | Prefix for an integration’s config values (`name::`).                  |
| `moduleConfigKeyPrefix(integration, module)` | Prefix for a module instance under an integration.             |
| `deleteIntegrationConfigKeys(name)` | Deletes all keys under the integration config prefix.                |
| `deleteModuleConfigKeys(integration, module)` | Deletes all keys under the module config prefix.             |
| `renameModuleConfigKeys(integration, from, to)` | Moves module config keys from one instance id to another.    |

Invalid keys throw. `watch` throws when `handler` is not a function.

Module preferences use these helpers through [Configuration](../modules/configuration.md). User integrations use `getValue` / `setValue` in `UserIntegrationsStore`. The [integration editor](../integrations/editor-ui.md) uses the prefix helpers when Save renames or removes module instances.

## See also

- [Configuration](../modules/configuration.md)
- [TypeScript integration](../integrations/README.md)
- [Integration editor](../integrations/editor-ui.md)
