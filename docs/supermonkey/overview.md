# Super Monkey Overview

**Super Monkey** is a browser userscript. The name nods to classic userscript managers (Greasemonkey, Tampermonkey, and similar).

The script runs **inside the page** via the user’s userscript extension. We aim to stay extension-agnostic, with **Tampermonkey** as the minimum compatibility target.

On HTTP(S) pages covered by the userscript metadata, the top browsing context boots `SuperMonkey`, matches a site integration, and coordinates isolated components through `EventBus`.

## Goals

- Run as a userscript in the pages you browse
- Stay extension-agnostic, with Tampermonkey as the primary target
- Keep the boot path small and explicit
- Isolate peer components: they meet on `EventBus`, not through direct imports (orchestrator-scoped reads of `SuperMonkey.loadedIntegration` are allowed)
- Treat `INTEGRATION_LOADED` as once-per-tab chrome setup; treat `CONTENT_LOADED` as content-ready (owned by Content Manager, republishable)
- Publish `BEFORE_UNLOAD` so components can flush work when the tab leaves

## Tech stack

| Layer               | Choice                                                              |
| ------------------- | ------------------------------------------------------------------- |
| Build               | [Vite](https://vite.dev/)                                           |
| Userscript bundling | [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) |
| Language            | TypeScript                                                          |
| Package manager     | pnpm                                                                |
| Runtime             | Browser (Tampermonkey as primary target)                            |

Entry point: `src/main.ts` → `SuperMonkey.run()` in the top frame only (runtime check plus `@noframes`).

Userscript metadata (`@name`, `@match`, `@connect`, `@noframes`, `@run-at`, and related fields) is configured in `vite.config.ts` under the `monkey()` plugin options. `@grant` entries are emitted by vite-plugin-monkey from the APIs the bundle uses.

## Layout

```
src/
  main.ts
  vite-env.d.ts
  supermonkey/
    supermonkey.ts
    constants.ts
    lifecycle/
    event-bus/
    content-manager/
    modules/
    integrations/
      builtin/          # BuiltinIntegrations + per-integration .ts files
      menu/
      store/
      editor/
    utils/
vite.config.ts
tsconfig.json
package.json
```

Register shipped integrations under `integrations/builtin/` — [Register a built-in integration](../integrations/README.md#register-a-built-in-integration).

## Architecture at a glance

| Concern                 | Location                                                   | Docs                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap and lifecycle | `SuperMonkey`, `Component`                                 | [Lifecycle](./lifecycle.md)                                                                                                                                                 |
| Active runtime handle   | `SuperMonkey.loadedIntegration`                            | [Lifecycle](./lifecycle.md) · [TypeScript integration](../integrations/README.md)                                                                                           |
| Pub/sub                 | `EventBus`                                                 | [Event bus](../utils/event-bus.md) · [Lifecycle](./lifecycle.md)                                                                                                            |
| Site matching           | `IntegrationLoader`, `IntegrationsRegistry`                | [TypeScript integration](../integrations/README.md)                                                                                                                         |
| Integrations list       | `IntegrationsMenu`                                         | [Integrations Menu](../modules/integrations-menu.md)                                                                                                                        |
| User storage            | `UserIntegrationsStore`                                    | [TypeScript integration](../integrations/README.md)                                                                                                                         |
| Content mapping         | `ContentManager`, `ContentManagerLoader`                   | [Content Manager](../modules/content-manager.md)                                                                                                                            |
| Page name filters       | `passesPageFilter`                                         | [Page filter](../utils/page-filter.md)                                                                                                                                      |
| Value extraction        | `ValueSource`, `resolveValue`                              | [Value source](../utils/value-source.md)                                                                                                                                    |
| Opts normalization      | `Normalized`, `OptsNormalization`                          | [Opts normalization](../utils/opts-normalization.md)                                                                                                                        |
| Feature modules         | `ModuleLoader`, `Module`                                   | [Authoring a module](../modules/authoring.md)                                                                                                                               |
| Static chrome           | `NotificationBar`, `ConfigurationMenu`, `IntegrationsMenu` | [Notification Bar](../modules/notification-bar.md) · [Configuration](../modules/configuration.md#configuration-menu) · [Integrations Menu](../modules/integrations-menu.md) |
| Module preferences      | `AbstractConfiguration`, `Action`                          | [Configuration](../modules/configuration.md)                                                                                                                                |
| Value storage           | `getValue` / `setValue` / `watch`                          | [Value storage](../utils/value-storage.md)                                                                                                                                  |
| Console logging         | `Logger`                                                   | [Logger](../utils/logger.md)                                                                                                                                                |

## For contributors

| You want to ... | Start here |
| --------------- | ---------- |
| Understand boot order | [Lifecycle](./lifecycle.md) · [Event bus](../utils/event-bus.md) |
| Register a built-in | [Register a built-in integration](../integrations/README.md#register-a-built-in-integration) |
| Add a feature module | [Authoring a module](../modules/authoring.md) · [Modules overview](../modules/README.md) |
| Look up a type | [TypeScript API index](../integrations/typescript-api.md) |
| Ship a release | [Releasing](../development/releasing.md) |
| Agent invariants | `AGENTS.md` at the repository root |

### For maintainers (core map)

Read in this order when rebuilding the architecture map:

1. [Overview](./overview.md) (this page)
2. [Script Lifecycle](./lifecycle.md)
3. [Event bus](../utils/event-bus.md)
4. [Modules overview](../modules/README.md) · [Content Manager](../modules/content-manager.md)
5. [TypeScript integration](../integrations/README.md)
6. [Utils overview](../utils/README.md)
7. [Getting Started](../development/getting-started.md)
8. [Releasing](../development/releasing.md)
9. [Documentation Site](../development/documentation-site.md)
10. `AGENTS.md` (documentation policy and agent invariants)

### Ship or change a built-in

1. [Register a built-in](../integrations/README.md#register-a-built-in-integration) (or [maintain](../integrations/README.md#maintain-a-coded-built-in) an existing file such as `reddit_com.ts`).
2. Align the human catalog: root [README](../../README.md) Built-in integrations table and [Using shipped integrations](./using-shipped.md) when hosts change.
3. [Releasing](../development/releasing.md) built-ins checklist before cutting a version.
4. [Documentation Site](../development/documentation-site.md) — update indexes/sidebar when pages move; keep cover free of empty-registry framing.

## Next steps

- [Installing Super Monkey](./installing.md) - choose the GitHub Release, production-build, or local development path
- [Use what shipped](./using-shipped.md) - first run with built-ins
- [Getting Started](../development/getting-started.md) - run locally
- [Lifecycle](./lifecycle.md) - boot order, isolation, lifecycle events
- [Event bus](../utils/event-bus.md) - pub/sub contract
- [TypeScript integration](../integrations/README.md) - registry, storage, register built-ins
- [Content Manager](../modules/content-manager.md) - groups, views, listings, and events
- [Authoring a module](../modules/authoring.md) - subclass `Module` and register a constructor
- [Logger](../utils/logger.md) - `this.log` and `Logger.setLevel`
- [Configuration](../modules/configuration.md) - stored preferences and style mixin
- [Editor Extensions](../development/editor-extensions.md) - recommended VS Code / Cursor extensions
- [Dev Container](../development/dev-container.md) - optional consistent Node.js / pnpm environment
- [Debugging](../development/debugging.md) - Firefox debug workflow
