# Authoring a module

End-to-end path for adding a feature module: subclass `Module`, normalize its opts, register a constructor key in `ModuleLoader`, register a typed editor opts form, document the opts shape, then enable it on an integration.

Source: `src/supermonkey/modules/module.ts`, `src/supermonkey/modules/module-loader.ts`. Wiring reference: [Modules overview](./README.md).

## When to add a module

| Need | Where it belongs |
| ---- | ---------------- |
| Per-site behavior that integration authors enable and configure | Feature module under `integration.modules` |
| Capability for every active integration | Static module after feature instances (Notification Bar, Configuration Menu, Integrations Menu) |
| Page styling only | [Custom CSS](./custom-css.md) |
| Page JS escape hatch | [JS Snippets](./js-snippets.md) |
| Discovering content ids and listed entries | [Content Manager](./content-manager.md) |

One integration can run several instances of the same module with different opts and instance ids.

## Checklist - new feature module

1. Add `src/supermonkey/modules/<feature>/` with the class file and an opts + `normalize*Opts` file returning [`Normalized<T>`](../utils/opts-normalization.md).
2. Subclass `Module` with `constructor(name, opts)` calling `super(name, opts)`; override `title` / `description` getters as needed.
3. Override the correct hooks (`onIntegrationLoaded` vs `onContentLoaded` / entity hooks).
4. Register `[constructorKey, { constructor, optsNormalizer }]` in `MAPPED_MODULES` (`module-loader.ts`).
5. Register a typed editor opts form under `integrations/editor/module-opts/` and import it from `register-builtin-opts-forms.ts`.
6. Add a docs page with **Options shape** + **In the editor** (and TypeScript wiring), link it from [Modules overview](./README.md) and [docs/README.md](../README.md), and add a sidebar entry under Modules.
7. Wire a test instance in a built-in or the editor; `pnpm build`, reload, confirm load without FATAL and opts validation on Save.

## 1. Subclass `Module`

Place the module under `src/supermonkey/modules/<feature>/` (for example `xpto-highlight.ts`, `xpto-highlight-opts.ts`).

`ModuleLoader` constructs instances as `new Constructor(instanceName, opts)`:

```ts
import { Module } from "../module";
import type { EntitiesInjectedEventPayload } from "../../content-manager/events";
import type { XptoHighlightOpts } from "./xpto-highlight-opts";

const LABEL = "Xpto Highlight";
const DESCRIPTION = "Highlights promoted entries on Xpto listings.";

export class XptoHighlight extends Module<XptoHighlightOpts> {
  constructor(name: string, opts: XptoHighlightOpts) {
    super(name, opts);
  }

  override get title(): string {
    return LABEL;
  }

  override get description(): string | undefined {
    return DESCRIPTION;
  }

  protected override async onEntitiesInjected(
    data: EntitiesInjectedEventPayload,
  ): Promise<void> {
    this.log.debug("Highlighting", this.opts.selector, data.entities.size, "group(s)");
  }
}
```

| Member | Role |
| ------ | ---- |
| `name` | Composed instance id `{integration}::{instance}` |
| `opts` | Feature options (already normalized when `optsNormalizer` is registered) |
| `log` | `Logger` scoped to the instance name |
| `title` / `description` | Configuration Menu section labels |
| `configurations` / `notifications` | Override getters to expose prefs and Notification Bar icons |

## 2. Normalize opts

Export `normalizeXptoHighlightOpts(raw: unknown): Normalized<XptoHighlightOpts>` and reject when required fields are missing. See [Opts normalization](../utils/opts-normalization.md). `validateIntegration` runs the same normalizer on Save/Import when the module key is registered with `optsNormalizer`.

## 3. Register a constructor

`ModuleLoader` looks up `entry.module` in `MAPPED_MODULES` (`src/supermonkey/modules/module-loader.ts`). Registered constructor keys:

| Key                   | Module               | Docs                                              |
| --------------------- | -------------------- | ------------------------------------------------- |
| `AdditionalPages`     | Additional Pages     | [Additional Pages](./additional-pages.md)         |
| `CustomCss`           | Custom CSS           | [Custom CSS](./custom-css.md)                     |
| `History`             | History              | [History](./history.md)                           |
| `JsSnippets`          | JS Snippets          | [JS Snippets](./js-snippets.md)                   |
| `KeyboardNavigation`  | Keyboard Navigation  | [Keyboard Navigation](./keyboard-navigation.md)   |
| `ResourcesDownloader` | Resources Downloader | [Resources Downloader](./resources-downloader.md) |

Add a `[constructorKey, { constructor, optsNormalizer? }]` entry:

| Field            | Role                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `constructor`    | `new (name, opts) => Module`                                                                                |
| `optsNormalizer` | Optional `(opts: unknown) => Normalized<object>`. See [Opts normalization](../utils/opts-normalization.md). |

Unknown constructor keys or a rejected opts walk log FATAL for that instance and skip it; other instances still load. A repaired value logs WARN and still constructs.

## 4. Instance name and Configuration

The constructed `name` is `mergeIds(integration.name, instanceKey)` - `{integration}::{instance}`. `Module` throws when that name is not a valid composed id.

Pass `this.name` as the first argument of every [Configuration](./configuration.md) constructor so stored keys stay `{integration}::{instance}::{setting}`. `Action` takes the same `moduleName` and a `key` and has no storage.

## 5. Hooks and surface

`Module` extends `Component` (`onIntegrationLoaded`, `onContentLoaded`, `onBeforeUnload`). The constructor also subscribes to Content Manager events:

| Hook                 | Event               |
| -------------------- | ------------------- |
| `onEntityViewed`     | `entity-viewed`     |
| `onEntitiesParsed`   | `entities-parsed`   |
| `onEntitiesInjected` | `entities-injected` |

Defaults are no-ops. See [Event bus](../utils/event-bus.md) and [Handler interleaving](../supermonkey/lifecycle.md#handler-interleaving).

After `integration.modules`, `ModuleLoader` always constructs the static `notificationBar`, `configurationMenu`, and `integrationsMenu` instances. The map is stored on `SuperMonkey.loadedIntegration.modules`.

## 6. Document and wire

- Docs page: Options shape + In the editor + TypeScript wiring (mirror [History](./history.md)).
- Typed editor form in `integrations/editor/module-opts/` registered beside other module opts forms.
- Index: [Modules overview](./README.md), [docs/README.md](../README.md), [`_sidebar.md`](../_sidebar.md).
- Built-in or editor instance under `modules` with your constructor key.
- Verify: `pnpm build`, reload, Integrations Menu **active**, no FATAL `Failed to load module:`.

## See also

- [Logger](../utils/logger.md)
- [Modules overview](./README.md)
- [Event bus](../utils/event-bus.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Configuration](./configuration.md)
- [Notification Bar](./notification-bar.md)
- [Integrations Menu](./integrations-menu.md)
- [Content Manager](./content-manager.md)
- [TypeScript API index](../integrations/typescript-api.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
- [Contributing](../development/contributing.md)
