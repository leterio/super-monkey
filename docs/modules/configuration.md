# Configuration

## Everyday use

When an integration is **active**, open preferences from:

- The Tampermonkey command **Toggle SuperMonkey configuration**, or
- The gear icon on the [Notification Bar](./notification-bar.md#what-you-see-on-the-page)

The panel lists settings and buttons that loaded modules expose for this site (for example Notification Bar corner position and icon size, History hide/decorate toggles, or Additional Pages “pages to load”). Change a value and it applies immediately for that integration. You do not need TypeScript for everyday preferences.

Authors who define new settings: continue below.

## Authoring API

A module exposes stored preferences and click actions through `Module.configurations`.

`Configuration` is `AbstractConfiguration<T> | Action` (`src/supermonkey/modules/configuration/`).

## Storage key

Constructors take `moduleName` first (`moduleName`, `key`, `defaultValue`, `opts?`). `Action` is (`moduleName`, `key`, `handler`, `opts`).

`AbstractConfiguration` builds `{moduleName}::{settingKey}` with `mergeIds`. `moduleName` is already `{integration}::{instance}`. `settingKey` is one id segment (`[A-Za-z0-9_-]+`).

Reads, writes, and watchers go through `getValue` / `setValue` / `watch` (`src/supermonkey/utils/value.ts`). Setting `value` to `null` deletes the Tampermonkey key. A non-null set that fails `isValid` throws. The constructor default must pass `isValid` (`assertValidDefault` on typed subclasses).

`watch(handler)` returns `{ unwatch() }`. The handler receives `(oldValue, newValue, remote)`.

Optional `ConfigurationOpts`: `label`, `description`.

## Types

| Class                         | Stored type | Validity                                                                 |
| ----------------------------- | ----------- | ------------------------------------------------------------------------ |
| `BooleanConfiguration`        | `boolean`   | Non-null boolean.                                                        |
| `StringConfiguration`         | `string`    | String. `invalidEmptyString: true` rejects `""`.                         |
| `NumberConfiguration`         | `number`    | Finite; integer unless `allowDecimals`. Optional `min` / `max`. Setter rounds when decimals are disallowed. |
| `StringSelectConfiguration`   | `string`    | Super string rules, then membership in `options` (empty string stays valid). Requires a non-empty `options` list. `optionsLabels` maps value → label. |
| `ArrayConfiguration<T>`       | `T[]`       | Non-null array. The configuration panel has no control for this type.        |

## Style mixin

`StyleConfiguration(Base)` wraps an `AbstractConfiguration` subclass. `opts.css` is required: a string (applied when the value is non-null) or `(value) => string | null | undefined`. Construction injects a `<style>` in `document.head` and applies immediately.

The style reapplies when:

- `value` is set on the instance
- A **remote** storage change arrives (`watch`)
- A `triggeredBy` configuration fires `watch`

`BooleanStyleConfiguration` clears the style text when the value is `false`.

`BooleanStyleConfiguration`, `StringStyleConfiguration`, `NumberStyleConfiguration`, and `StringSelectStyleConfiguration` wrap those primitive types and require `StyleConfigurationOpts` (`css`, optional `triggeredBy`). `ArrayConfiguration` has no style variant.

## Action

`Action` is a click handler with `moduleName`, `key`, `handler`, and `opts`. It has no Tampermonkey storage. `key` may be a single id segment or a composed id from `mergeIds`; the configuration panel uses it as the control id. The practical effect is a button that runs `handler`.

## Configuration Menu

`ConfigurationMenu` is a static `Module`. After feature instances load, `ModuleLoader` constructs `{integration}::configurationMenu`.

On `INTEGRATION_LOADED` it registers the Tampermonkey command `Toggle SuperMonkey configuration`. The gear [Notification Bar](./notification-bar.md) entry opens a panel that lists every loaded module with a non-empty `configurations` array (`title` / `description` as section headers). Inputs come from `buildConfigurationInput` (`src/supermonkey/modules/configuration/menu/input-builder.ts`) for boolean, number, string, string-select, and Action. `ArrayConfiguration` is not rendered.

The panel subtitle is `Integration: {integration}` (first segment of the composed instance name).

## See also

- [Authoring a module](./authoring.md)
- [Notification Bar](./notification-bar.md)
- [Logger](../utils/logger.md)
- [Value storage](../utils/value-storage.md)
- [Opts normalization](../utils/opts-normalization.md)
