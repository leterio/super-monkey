# Debugging (VS Code / Cursor)

Debug sessions for Super Monkey use **Firefox** (recommended). Install the Debugger for Firefox extension listed in [Editor Extensions](./editor-extensions.md).

## Prerequisites

1. Install the Debugger for Firefox extension (see [Editor Extensions](./editor-extensions.md)).
2. Generate local HTTPS certificates and start the dev server (see [Getting Started](./getting-started.md)).
3. Install Firefox on the machine where the browser UI runs. When using a Dev Container or remote editor, the container hosts Vite and the debug adapter; Firefox still runs on the host desktop.

## Launch configuration

Shared debug config lives in `.vscode/launch.json` (committed). The **Firefox** configuration is the supported path.

| Field                | Role                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `inputs.debugUrl`    | Page opened when debugging starts. Default: `https://example.com/`. Must match a `@match` entry in `vite.config.ts`. |
| `pathMappings`       | Maps Vite URLs under `/src` (`localhost` and `127.0.0.1`) to `${workspaceFolder}/src`.                               |
| `profileDir`         | Persistent profile under `~/.firefox/<project-name>` on the machine that runs Firefox.                               |
| `keepProfileChanges` | Keeps profile changes (extensions, cookies, etc.).                                                                   |
| `reAttach`           | Keeps Firefox running and reattaches on the next debug start.                                                        |
| `reloadOnAttach`     | Reloads matched tabs after re-attach so scripts load again and breakpoints can bind.                                 |
| `tabFilter`          | `*` matches all tabs for breakpoint attach.                                                                          |

### Avoid the URL prompt every session

Edit `default` under `inputs.debugUrl` in `.vscode/launch.json`, or replace `"${input:debugUrl}"` with a fixed URL in the Firefox configuration. Prefer keeping site-specific defaults out of commits if they are personal.

## Topologies

Firefox runs on any desktop OS (Linux, macOS, or Windows) where you can open a browser. Vite may run on the same machine or inside a Dev Container / remote host; port `5173` must be reachable from that browser (usually via local port forwarding).

| Setup         | Path                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Local         | Host → Cursor/VS Code → Vite + Firefox on the same machine                                                                                    |
| Dev Container | Host → Cursor/VS Code → Dev Container (Vite) → Firefox on the host                                                                            |
| Remote SSH    | Local machine → Cursor/VS Code → SSH → Dev Container (Vite) → Firefox on the machine that launches the browser (typically your local desktop) |

Breakpoints usually need `reAttach` + `reloadOnAttach`, `tabFilter: "*"`, and Vite/`pathMappings` covering both `localhost` and `127.0.0.1` (see `server.host` in `vite.config.ts`). If breakpoints stay gray, use the **Path Mapping Wizard** once (prefer keeping machine-specific mappings out of the repo).

## Workflow

1. Run `pnpm dev` (HTTPS on port `5173`; forwarded to the host when using a container or remote setup).
2. Start **Firefox** from Run and Debug.
3. Enter the target page URL when prompted (or rely on your local `default`).
4. Install or refresh the userscript from the [install URL](./getting-started.md#install-in-tampermonkey) in that Firefox profile if needed.
5. If breakpoints stay gray on the first start, **restart** the same **Firefox** config with Firefox still open. The re-attach reloads the tab and binds breakpoints.

## Runtime signals

The console is the fastest way to tell how far bootstrap went and which stage refused to continue.

Development builds log at debug on boot (trace when stored `logLevel` is `0`). Production builds log at info. The Integrations Menu footer is a TRACE through FATAL picker; it calls `Logger.setLevel` and applies the threshold immediately. See [Logger](../utils/logger.md).

Every line is prefixed with `SuperMonkey`, the level, and the emitting context (for example `IntegrationLoader`). Nested frames stay silent (`@noframes` plus the top-frame check in `src/main.ts`).

### Start from the symptom

1. **Super Monkey does not activate**
   - Find `Starting SuperMonkey ...`.
   - If `No integrations matched the current page` appears, check integration `matchedDomains` and the userscript `@match` entries in `vite.config.ts`.
   - If neither message appears, confirm that the userscript is installed and the current URL is covered by its metadata.
2. **The wrong integration activates**
   - Find `Multiple integrations matched the hostname; using the first one.` and read the matched names that follow.
   - Check each integration's `matchedDomains` and effective registry order, including [user overrides](../integrations/README.md#user-storage).
3. **A stored or built-in integration never appears**
   - Find `Skipping stored integration:` or `Skipping built-in integration:` and the findings.
   - Check the JSON against [integration normalization](../integrations/README.md#normalization).
4. **Content Manager finds no entries**
   - Find the `Discovered` view or listing entry count.
   - Check `contentManager.groups`, `views`, and `listings` in [Content Manager](../modules/content-manager.md).
   - FATAL `Failed to load content manager` means the opts walk rejected or construct failed. WARN `Content manager options were repaired:` means the instance still loaded. Omitting `contentManager` logs a skip and leaves Content Manager off.
5. **A second boot in the same tab**
   - Find `already initialized; Not attempting to run again.` Reload the tab so `SuperMonkey.run()` can run again.

### Trace a signal to its source

| Context label           | Primary source file(s)                                          |
| ----------------------- | --------------------------------------------------------------- |
| `SuperMonkey`           | `src/supermonkey/supermonkey.ts`                                |
| `IntegrationLoader`     | `src/supermonkey/integrations/integration-loader.ts`            |
| `IntegrationsRegistry`  | `src/supermonkey/integrations/integrations-registry.ts`         |
| `UserIntegrationsStore` | `src/supermonkey/integrations/store/user-integrations-store.ts` |
| `ContentManagerLoader`  | `src/supermonkey/content-manager/content-manager-loader.ts`     |
| `ContentManager`        | `src/supermonkey/content-manager/content-manager.ts`            |
| `ModuleLoader`          | `src/supermonkey/modules/module-loader.ts`                      |
| `EventBus`              | `src/supermonkey/event-bus/event-bus.ts`                        |
| `<component>`           | `src/supermonkey/lifecycle/component.ts` and the subclass       |

The Firefox launch configuration maps Vite `/src` URLs to the workspace `src/` directory through `pathMappings`. For execution order, see [Script Lifecycle](../supermonkey/lifecycle.md); for the source tree, see the [project layout](../supermonkey/overview.md#layout).

### Integration discovery

| Level | Context                 | Message                                                                    | Meaning                                                                |
| ----- | ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| DEBUG | `IntegrationLoader`     | `Finding matching integration`                                             | Match resolution started                                               |
| INFO  | `IntegrationLoader`     | `Matched integration:`                                                     | Single match stored                                                    |
| WARN  | `IntegrationLoader`     | `No integrations matched the current page. Feel free to create a new one!` | Bootstrap stops here; no lifecycle events publish                      |
| WARN  | `IntegrationLoader`     | `Multiple integrations matched the hostname; using the first one.`         | Matched names follow; the first registry entry wins                    |
| WARN  | `IntegrationsRegistry`  | `Skipping stored integration:` / `Skipping built-in integration:`          | Normalize rejected; map key and findings follow                        |
| WARN  | `IntegrationsRegistry`  | `Stored integration repaired:` / `Built-in integration repaired:`          | Normalize kept a value; findings follow                                |
| DEBUG | `UserIntegrationsStore` | `Stored integrations loaded`                                               | Stored entry names follow (`Stored integrations are empty` when empty) |

### Bootstrap and lifecycle

| Level | Context       | Message                                                         | Meaning                                         |
| ----- | ------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| INFO  | `SuperMonkey` | `Starting SuperMonkey ...`                                      | `run()` reached                                 |
| DEBUG | `SuperMonkey` | `Waiting for page to load ...`                                  | Awaiting document ready before `INTEGRATION_LOADED` |
| DEBUG | `SuperMonkey` | `Page ready; Dispatching integration loaded event ...`          | `INTEGRATION_LOADED` publishes                      |
| DEBUG | `SuperMonkey` | `Binding before unload event ...`                               | Native `beforeunload` is bound                  |
| DEBUG | `SuperMonkey` | `SuperMonkey initialized successfully`                          | Bootstrap finished                              |
| ERROR | `SuperMonkey` | `SuperMonkey already initialized; Not attempting to run again.` | Second `run()` in the same tab                  |
| ERROR | `SuperMonkey` | `Failed to init SuperMonkey.`                                   | Bootstrap threw; the error message follows (includes `Invalid integration name:` when the matched `name` is not a valid id segment) |

Stage boundaries and what is safe at each one: [Script Lifecycle](../supermonkey/lifecycle.md).

### Content Manager

| Level | Context                | Message                                                          | Meaning                                                      |
| ----- | ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| FATAL | `ContentManagerLoader` | `Failed to load content manager`                                 | Opts rejected or construction failed; Content Manager is off |
| WARN  | `ContentManagerLoader` | `Content manager options were repaired:`                         | Normalize kept a value; findings follow                      |
| DEBUG | `ContentManagerLoader` | `Content manager not configured; Skipping content manager load.` | `contentManager` omitted                                     |
| DEBUG | `ContentManagerLoader` | `Content manager successfully loaded`                            | Instance constructed                                         |
| ERROR | `ContentManagerLoader` | `Content manager already loaded; Not attempting to load again.`  | Second `load` in the same tab                                |
| INFO  | `ContentManager`       | `Discovered` ... `view entities`                                 | View scan found entries (TRACE dumps the payload)            |
| INFO  | `ContentManager`       | `Discovered` ... `new listing entities`                          | Listing scan found entries (TRACE dumps the payload)         |
| DEBUG | `ContentManager`       | `Integration loaded; Publishing CONTENT_LOADED for live document` | First `CONTENT_LOADED` from Content Manager                |
| DEBUG | `ContentManager`       | `Running page scan (views + listings)`                           | `CONTENT_LOADED` scan started                                |
| DEBUG | `ContentManager`       | `Listing apply finished:`                                        | Hidden / injected / kept counts follow                       |
| DEBUG | `ContentManager`       | `No listing containers for group:`                               | Listing scan found no containers for that group              |
| WARN  | `ContentManager`       | `CONTENT_LOADED without document; skipping page scan`            | Payload missing `document`                                   |

Group, view, and listing configuration: [Content Manager](../modules/content-manager.md). Findings: [Opts normalization](../utils/opts-normalization.md).

### Modules

| Level | Context        | Message                                         | Meaning                                                                      |
| ----- | -------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| FATAL | `ModuleLoader` | `Failed to load module: <instance>`             | Unknown key, rejected opts, or constructor failure; that instance is skipped |
| WARN  | `ModuleLoader` | `Module options were repaired:`                 | `optsNormalizer` kept a value; instance name and findings follow             |
| DEBUG | `ModuleLoader` | `Constructed module instance:`                  | Instance name after successful construction                                  |
| DEBUG | `ModuleLoader` | `Loaded` ... `module instances for integration` | Instance count for the active integration                                    |

### Event bus

| Level | Context    | Message                                        | Meaning                                        |
| ----- | ---------- | ---------------------------------------------- | ---------------------------------------------- |
| DEBUG | `EventBus` | `Publishing event`                             | Normalized event type and handler count follow |
| TRACE | `EventBus` | `Event payload:`                               | Publish data when present                      |
| WARN  | `EventBus` | `subscribe ignored: invalid event type`        | The type was empty or not a string             |
| WARN  | `EventBus` | `subscribe ignored: handler is not a function` | Handler argument rejected                      |
| WARN  | `EventBus` | `publish ignored: invalid event type`          | Nothing was delivered                          |
| ERROR | `EventBus` | `handler threw`                                | A handler failed; other handlers still ran     |

## Firefox: disable Local Network Access check

Current Firefox versions enable **Local Network Access** (`network.lna.enabled`) by default. With that check on, userscripts / Vite assets from `https://localhost` can fail to load intermittently during development.

In the Firefox profile used for this project:

1. Open `about:config`.
2. Search for `network.lna.enabled`.
3. Set it to **`false`**.

## See also

- [Logger](../utils/logger.md)
- [Getting Started](./getting-started.md)
- [Editor Extensions](./editor-extensions.md)
- [Dev Container](./dev-container.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
