# TypeScript integration

An **integration** is the site configuration Super Monkey activates for a hostname. `IntegrationLoader` picks the first entry in the [effective registry](#effective-registry) whose `matchedDomains` match the tab hostname. After a match, `SuperMonkey.loadedIntegration` holds that entry's runtime handle (`name`, `getActivePages`, optional `contentManager`, and `modules`).

Define integrations in TypeScript (`Integration` in `src/supermonkey/integrations/metadata.ts`) or persist them through `UserIntegrationsStore`. Both shapes share the same fields. The registry [normalizes](#normalization) every entry before match.

## `Integration` fields

| Field             | Role                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `name`            | Unique id. One segment (`[A-Za-z0-9_-]+`). An invalid name is a hard error at activate time.  |
| `matchedDomains`  | Hostnames and globs that activate this integration. Supports `!!` negations.                  |
| `mappedPages`     | Optional named pathname pages (`name` + `paths` globs). Omit when empty. Active names: `loadedIntegration.getActivePages()`. See [Path patterns](./dsl.md#path-patterns). |
| `contentManager`  | Optional [Content Manager](../modules/content-manager.md) options. Omit to skip load.          |
| `modules`         | Optional named module instances. Record key is the instance id; `module` is the constructor key. Constructed name is `{integration}::{instance}`. See [Authoring a module](../modules/authoring.md). |
| `defaults`        | Optional bag of specific overrides for this integration. See [Defaults consumers](#defaults-consumers). |

Match-rule syntax: [Integration DSL](./dsl.md).

### Mapped pages (TypeScript)

Each entry is `{ name, paths }` where `name` is a stable id segment and `paths` is an array of pathname globs (same rules as the editor CSV, including optional `!!` exclusions). Omit `mappedPages` when empty.

At runtime, `SuperMonkey.loadedIntegration.getActivePages()` returns the names whose path patterns match the current tab pathname. Content Manager view/listing `pageFilter` values and Resources Downloader mapping `pageFilter` values use those names — not History record/decorate name filters.

Factory used at bootstrap: `createGetActivePages` in `src/supermonkey/integrations/mapped-pages.ts`. Path glob rules: [Path patterns](./dsl.md#path-patterns). Filter helper: [Page filter](../utils/page-filter.md). Editor field map (same shape): [Mapped pages](./editor-ui.md#mapped-pages).

## Defaults consumers

| Key path | Consumer | Docs |
| -------- | -------- | ---- |
| `notificationBar.position` | Notification Bar default corner when valid | [Notification Bar](../modules/notification-bar.md) |

Other keys are ignored until a module or chrome owner documents them. Opaque bag rules: [Integration DSL - Defaults](./dsl.md#defaults).

## Built-in registry

Release builds of Super Monkey ship built-in integrations with the userscript. They appear in the [Integrations Menu](../modules/integrations-menu.md) with provenance **`builtin`**. End-user discovery: [Using shipped integrations](../supermonkey/using-shipped.md).

`BuiltinIntegrations.getIntegrations()` returns the declaration-order list in `src/supermonkey/integrations/builtin/builtin.ts`. Hostname match also uses [user storage](#user-storage) entries in the [effective registry](#effective-registry).

When you work from a local clone, append entries with [Register a built-in integration](#register-a-built-in-integration) so the menu lists the built-ins you are shipping. Until a name is registered (or stored by the user), that hostname does not activate Super Monkey features.

### Register a built-in integration

**First built-in in about ten minutes**

1. Add `src/supermonkey/integrations/builtin/<name>.ts` with `name` + `matchedDomains`.
2. Append the constant to `INTEGRATIONS` in `builtin.ts`.
3. Run `pnpm dev` (or `pnpm build`), reload the userscript, open a matching URL.
4. Integrations Menu → provenance **`builtin`** → **`active`** on that tab.
5. Optional: **Edit** → **Save** → **`override`** → **Reset**.

Normalization and full lifecycle are optional for a domain-only stub.

**After the stub**

1. Add [mapped pages](#mapped-pages-typescript) when pathnames must gate Content Manager.
2. Configure Content Manager views/listings with [page filter](../modules/content-manager.md#page-filter) against those names.
3. Attach module opts (Share JSON from the editor, or per-module Options shape pages — [module keys](#module-opts-by-key)).
4. Skim [Lifecycle - Minimum read for built-in authors](../supermonkey/lifecycle.md#minimum-read-for-built-in-authors).

### Maintain a coded built-in

To change a **shipped** coded integration (for example `reddit_com`):

1. Edit `src/supermonkey/integrations/builtin/reddit_com.ts` (or the matching file), rebuild or reload the userscript, and confirm provenance **`builtin`** still applies after a clean **Reset** of any override.
2. Prefer a temporary [storage override](#effective-registry) (**Edit** → **Save** in the menu) for experiments on a live tab; **Reset** restores the TypeScript definition without changing the repo.

Living reference: `src/supermonkey/integrations/builtin/reddit_com.ts`. Symbol map: [TypeScript API index](./typescript-api.md).

**Detailed steps**

1. Add a file under `src/supermonkey/integrations/builtin/` (for example `example_com.ts`).
2. Export an `Integration` constant with `name` and `matchedDomains` (plus optional `mappedPages`, `contentManager`, `modules`, and `defaults`):

```ts
import { Integration } from "../metadata";

export const EXAMPLE_COM_INTEGRATION: Integration = {
  name: "example_com",
  matchedDomains: ["example.com", "www.example.com"],
};
```

3. In `src/supermonkey/integrations/builtin/builtin.ts`, import that constant and append it to the private `INTEGRATIONS` array on `BuiltinIntegrations`.
4. Run `pnpm build` or `pnpm dev`, reload the userscript, and open a URL covered by those domains.
5. Open the [Integrations Menu](../modules/integrations-menu.md) and confirm provenance **`builtin`** and, on a matching tab, the **active** badge.

Userscript `@match` in `vite.config.ts` is broad (`http://*/*` and `https://*/*`). Activation on a tab is controlled by `matchedDomains`, not by editing the userscript header for each new host.

**Editor text ↔ TypeScript arrays:** in the UI, **Matched domains**, **Page filter**, mapped-page **Paths**, and selector lists are comma-separated (CSV). On a typed `Integration` (and in Share JSON), the same values are `string[]`. When you paste Share JSON into a `.ts` file, keep arrays — do not wrap a CSV string as a single element unless you intend one pattern that contains commas.

**Page filter consumers:** mapped page **names** feed `loadedIntegration.getActivePages()`, Content Manager `pageFilter` on views/listings, and Resources Downloader mapping `pageFilter`. History name filters use Content Manager **view** / **listing** names, not mapped page names. See [Page filter](../utils/page-filter.md).

### From editor Share JSON to typed `Integration`

1. In the Integrations Menu, **Share** an integration (or finish the [tutorial](./tutorial.md) and export the JSON).
2. Copy the object into a new file under `src/supermonkey/integrations/builtin/`.
3. Type it as `Integration` (import `ScanMode` and other enums as needed — see the tutorial TypeScript section). Keep `matchedDomains`, `paths`, selector lists, and page-filter fields as **`string[]`** (those fields are CSV in the editor).
4. Convert Content Manager `scanMode` strings to the enum: JSON `"onload"` → `ScanMode.ONLOAD`, `"interval"` → `ScanMode.INTERVAL` (import from `content-manager/metadata`). Other Share fields that are plain strings/objects stay as typed literals.
5. Append the constant to `INTEGRATIONS` as in the steps above.

End-to-end Atlas shape: [Tutorial - TypeScript / coded built-in authors](./tutorial.md#typescript--coded-built-in-authors).

### Module opts by key

| Module key | Opts narrative |
| ---------- | -------------- |
| `AdditionalPages` | [Additional Pages](../modules/additional-pages.md#options-shape) |
| `CustomCss` | [Custom CSS](../modules/custom-css.md#options-shape) |
| `History` | [History](../modules/history.md#options-shape) |
| `JsSnippets` | [JS Snippets](../modules/js-snippets.md#options-shape) |
| `KeyboardNavigation` | [Keyboard Navigation](../modules/keyboard-navigation.md#options-shape) |
| `ResourcesDownloader` | [Resources Downloader](../modules/resources-downloader.md#options-shape) |
| `contentManager` / `ScanMode` | [Content Manager](../modules/content-manager.md) |

## User storage

`UserIntegrationsStore` persists a map of user integrations in Tampermonkey storage under `superMonkeyUserIntegrations` (`src/supermonkey/integrations/store/user-integrations-store.ts`). Reads and writes go through `getValue` / `setValue` (`src/supermonkey/utils/value.ts`). Map keys are integration `name` (one id segment).

| Method       | Behavior                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `loadAll()`  | Returns a shallow copy of the stored map, or `{}` when empty or invalid. |
| `put(integration)` | Upserts `structuredClone(integration)` at `integration.name`.      |
| `remove(name)` | Deletes that key. Returns `false` when the name is absent.             |
| `has(name)`  | Whether the name exists in the stored map.                               |

Inspect or edit the map from the script **Storage** tab in the Tampermonkey dashboard.

## Normalization

`normalizeStoredIntegration(stored, mapKey)` returns [`Normalized<Integration>`](../utils/opts-normalization.md) (`src/supermonkey/integrations/store/normalize-stored-integration.ts`).

| Field              | Rule                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Entry              | Must be a plain object. Otherwise **reject**.                                                 |
| `name`             | Non-empty valid id from `stored.name`, or the map key when `name` is omitted or blank. Invalid **reject**. |
| `matchedDomains`   | Array of valid domain patterns after trim and `!!` normalization. Invalid entries are **repaired** away. Zero usable positives **reject**. |
| `mappedPages`      | Array of `{ name, paths }`. Each `name` is a unique valid id; each `paths` entry is a valid pathname glob (optional `!!`). Invalid pages/paths are **repaired** away; duplicates keep the first. Zero usable positives **drop** the page. Empty after cleanup is omitted. |
| `contentManager`   | Opaque `structuredClone` when it is a plain object. Non-objects are repaired away. Content Manager rules run in [its loader](../modules/content-manager.md#normalization). |
| `modules`          | Instance keys must be valid ids; `module` a non-empty string; `opts` cloned when a plain object (non-object `opts` omitted with no finding; the instance remains). Bad instance keys or `module` values are repaired away. |
| `defaults`         | Opaque clone when it is a plain object; otherwise repaired away.                              |

`IntegrationsRegistry` runs this walk for **built-ins and stored** entries. A reject skips that entry (`Skipping built-in integration:` / `Skipping stored integration:`). A repaired value is kept (`Built-in integration repaired:` / `Stored integration repaired:`).

## Effective registry

`IntegrationsRegistry.getEffective()` builds the list `IntegrationLoader` matches against:

1. Normalize each built-in and keep it by `name`.
2. Normalize each stored entry and **replace** the built-in with the same `name`.
3. Skip an entry that rejects.

Order follows first insertion (built-ins, then successful stored names that were not already present). A stored override keeps the slot of the built-in it replaced.

When several effective entries match the hostname, the first wins.

`getProvenance(name)` reports how that name entered the registry: `builtin`, `user`, or `override` (stored replaced a built-in).

## Integrations menu

`IntegrationsMenu` (`src/supermonkey/integrations/menu/integrations-menu.ts`) registers the Tampermonkey command **Open Integrations Menu** at the start of `SuperMonkey.run()`, including when no hostname matches.

The panel lists effective integrations with a provenance badge and an `active` badge for `SuperMonkey.loadedIntegration?.name`. When a tab has a loaded integration, that row is first; remaining rows are sorted by name. Row actions open the [integration editor](./editor-ui.md) (**Edit**, **Share**) and manage storage (**Delete** for `user`, **Reset** for `override`). The footer has **Create**, **Import**, and a log-level picker (TRACE through FATAL). Changing the log level calls `Logger.setLevel`, which applies the threshold immediately and persists Tampermonkey `logLevel`.

When a hostname matches, a static [Integrations Menu](../modules/integrations-menu.md) module exposes an **Open integrations** Configuration action that opens the same overlay.

## See also

- [TypeScript API index](./typescript-api.md)
- [Logger](../utils/logger.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Integration DSL](./dsl.md)
- [Integration editor](./editor-ui.md)
- [Integrations Menu](../modules/integrations-menu.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
- [Debugging](../development/debugging.md)
