# Modules overview

Configure feature modules and Content Manager from the [Integration editor](../integrations/editor-ui.md). Each module page documents the opts shape for storage and TypeScript; the editor uses a typed form for every registered module key.

## Configure in the browser

Use the [Integration editor](../integrations/editor-ui.md) **Modules** panel. Registered keys:

| Module key            | Options reference                                               |
| --------------------- | --------------------------------------------------------------- |
| `AdditionalPages`     | [Additional Pages](./additional-pages.md#options-shape)         |
| `CustomCss`           | [Custom CSS](./custom-css.md#options-shape)                     |
| `History`             | [History](./history.md#options-shape)                           |
| `JsSnippets`          | [JS Snippets](./js-snippets.md#options-shape)                   |
| `KeyboardNavigation`  | [Keyboard Navigation](./keyboard-navigation.md#options-shape)   |
| `ResourcesDownloader` | [Resources Downloader](./resources-downloader.md#options-shape) |

Browser authors can stop here and open the module page for the key they selected. On each module page, **In the editor (Pattern A)** and **Options shape** describe the same stored `opts` (CSV in the UI, `string[]` in TypeScript). Contributors: wiring and load order below.

## Contributors (TypeScript wiring and load order)

Super Monkey splits page work into **Content Manager** (scan and events) and **feature modules** (react on `EventBus`).

### TypeScript / built-in wiring

Under `integration.modules`, each entry has an instance id (record key), a `module` constructor key, and optional `opts`. Example:

```ts
modules: {
  history_books: {
    module: "History",
    opts: { group: "books" },
  },
},
```

Register new constructors in `MAPPED_MODULES` — [Authoring a module](./authoring.md).

### Load order and Content Manager events

1. `ContentManagerLoader.load` (optional) constructs Content Manager.
2. `ModuleLoader` constructs each `integration.modules` instance (normalize opts → `new Constructor(name, opts)`).
3. Static modules: `notificationBar`, `configurationMenu`, `integrationsMenu`.
4. `INTEGRATION_LOADED` → Content Manager may publish `CONTENT_LOADED` (scans + module content hooks). See [Handler interleaving](../supermonkey/lifecycle.md#handler-interleaving).

| Module kind                   | Typical hooks                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| No Content Manager dependency | `onIntegrationLoaded`                                                                                       |
| Needs listings/views          | `onContentLoaded` and/or `onEntity*` / `onEntities*`                                                        |
| Static chrome                 | Loaded after feature instances; collect `configurations` / `notifications` from `loadedIntegration.modules` |

Pipeline events: [Content Manager - Events](./content-manager.md#events). Pub/sub: [Event bus](../utils/event-bus.md).

### Loaders and static chrome

| Piece              | Loader                  | Role                                                                                              |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------- |
| Content Manager    | `ContentManagerLoader`  | Maps views and listings; publishes parse / inject / view events.                                  |
| Feature module     | `ModuleLoader`          | Extends `Module`; constructed from `integration.modules`.                                         |
| Notification Bar   | `ModuleLoader` (static) | Floating icon row; collects `Module.notifications`.                                               |
| Configuration Menu | `ModuleLoader` (static) | Tampermonkey command + gear panel of `Module.configurations`.                                     |
| Integrations Menu  | `ModuleLoader` (static) | Configuration action that opens the integrations list (same overlay as the Tampermonkey command). |

Content Manager is not a `Module`. Feature modules do not import other modules. Modules without Content Manager dependency override `onIntegrationLoaded`. Content-dependent modules override `onContentLoaded` and may use `hasListingContext` through `SuperMonkey.loadedIntegration?.contentManager`.

`ModuleLoader` constructs each named instance from `integration.modules`, then the static modules. Instance ids are `{integration}::{instanceKey}`. An unknown constructor key logs FATAL (`Failed to load module`) and skips that instance. When a constructor is registered with an `optsNormalizer`, unknown `opts` run through that walk first - see [Opts normalization](../utils/opts-normalization.md).

`SuperMonkey.loadedIntegration?.modules` holds the constructed instances (feature plus static) for the static modules to collect configurations and notification entries.

Preferences live on `Module.configurations` - see [Configuration](./configuration.md).

## See also

- [Authoring a module](./authoring.md)
- [Additional Pages](./additional-pages.md)
- [Custom CSS](./custom-css.md)
- [History](./history.md)
- [JS Snippets](./js-snippets.md)
- [Keyboard Navigation](./keyboard-navigation.md)
- [Resources Downloader](./resources-downloader.md)
- [Configuration](./configuration.md)
- [Notification Bar](./notification-bar.md)
- [Integrations Menu](./integrations-menu.md)
- [Content Manager](./content-manager.md)
- [Event bus](../utils/event-bus.md)
- [TypeScript integration](../integrations/README.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
