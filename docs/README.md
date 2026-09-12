# Super Monkey - Documentation

**Super Monkey** runs **inside the pages you browse**. It discovers resources on the current site, supports download and history workflows, applies page customization, and surfaces a small in-page UI - always shaped by **which service** the tab belongs to.

### Use Super Monkey (three steps)

1. [Install](./supermonkey/installing.md) (Tampermonkey + the release `.user.js`).
2. Open a supported site — try [Reddit](https://www.reddit.com) — and confirm **Built-in** + **Active on this tab** in the [Integrations Menu](./modules/integrations-menu.md).
3. Details: [Using shipped integrations](./supermonkey/using-shipped.md). Customize later with Edit / Share / Reset if you want.

## Purpose

Super Monkey is a **collection of features** that complement compatible sites. **Shipped releases** include built-in integrations for supported services; you can also create your own in the browser or in TypeScript. Each site (or family of hosts) is an **integration**: when the page matches, the script loads the modules configured for that service. Features stay modular - one capability per module - so you enable history, CSS, listings, keyboard focus, or UI only where they belong.

Open the [Integrations Menu](./modules/integrations-menu.md) to see which built-ins the installed build includes ([Using shipped integrations](./supermonkey/using-shipped.md)).

## Motivation & author notes

Super Monkey consolidates everyday browsing needs—content tracking, downloads, page styling, and related helpers—into one Tampermonkey-targeted userscript. The happy path includes the integration editor UI; individual sites may still behave poorly in edge cases. The repository is maintained with support from AI agents as part of the author’s workflow.

## How you use it

1. **Use a shipped built-in** - Install Super Monkey, open a supported site, and confirm the integration is **active** in the [Integrations Menu](./modules/integrations-menu.md). Details: [Using shipped integrations](./supermonkey/using-shipped.md). Customize with **Edit** → **Save** (override); learn with **Share**; restore with **Reset**.
2. **Create or edit an integration in the browser** - [Integration editor](./integrations/editor-ui.md): domains, mapped pages, Content Manager, and typed module opts. Import and Share use the same stored JSON shape.
3. **Attach features** - Content Manager groups (views and listings), plus modules such as History, Custom CSS, JS Snippets, Additional Pages, Keyboard Navigation, and Resources Downloader.
4. **Verify on the live page** - reload, open the Integrations Menu for the **active** badge and provenance; optionally use [Runtime signals](./integrations/runtime-signals.md) and Elements markers.

Built-in integrations are also authored in TypeScript ([TypeScript integration](./integrations/README.md#register-a-built-in-integration)). Extending the codebase is under Project.

## Capabilities

| Area                     | What it covers                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Integrations**         | Match domains; register built-ins; store user integrations and overrides            |
| **Integration editor**   | Create, edit, import, share, reset, and delete integrations in the browser          |
| **Integrations Menu**    | Show the effective registry, active integration, provenance, actions, and log level |
| **Content Manager**      | Find items and listings on the page; resolve stable ids; publish content events     |
| **Additional Pages**     | Fetch extra listing pages and merge their entries into the live document            |
| **History**              | Remember listed/viewed content; hide, decorate, and back up history                 |
| **Resources Downloader** | Map resources in listings, decorate download controls, and run downloads            |
| **Custom CSS**           | Apply static and user-configurable integration-authored page styles                 |
| **JS Snippets**          | Run opt-in integration-authored page scripts on selected hooks                      |
| **Keyboard Navigation**  | Click previous/next page controls with configured keyboard shortcuts                |
| **Notification Bar**     | Display a floating icon row and module notification entries                         |
| **Configuration**        | Provide per-module preferences through the in-page Configuration Menu               |
| **Coordination**         | Run lifecycle stages and publish events so isolated features react through EventBus |

Shared helpers - **value sources** (read strings from the DOM or URL) and **opts normalization** (reject or repair invalid values) - keep extraction and configuration handling consistent across modules.

## Where to start

| You want to ...                               | Start here                                                                                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install or run Super Monkey                   | [Installing Super Monkey](./supermonkey/installing.md)                                                                                                                                              |
| Use or customize a shipped built-in           | [Using shipped integrations](./supermonkey/using-shipped.md) · [Integrations Menu](./modules/integrations-menu.md) · [Customize a matching integration](./integrations/editor-ui.md#customize-a-matching-integration) |
| Map a site or edit match rules                | [Integration editor](./integrations/editor-ui.md) · [End-to-end tutorial](./integrations/tutorial.md) · [Runtime signals](./integrations/runtime-signals.md)                                        |
| Match rule reference (domains and globs)      | [Integration DSL](./integrations/dsl.md) · [TypeScript integration](./integrations/README.md)                                                                                                       |
| Register a TypeScript built-in                | [Register a built-in integration](./integrations/README.md#register-a-built-in-integration) · [Getting Started](./development/getting-started.md)                                                     |
| Configure Content Manager or a feature module | [Integration editor](./integrations/editor-ui.md) · [Modules overview](./modules/README.md) · module pages below                                                                                    |
| Understand the product layout and stack       | [Overview](./supermonkey/overview.md)                                                                                                                                                               |
| Contribute to the core                        | [For maintainers (core map)](./supermonkey/overview.md#for-maintainers-core-map) · [For contributors](./supermonkey/overview.md#for-contributors) · [Lifecycle](./supermonkey/lifecycle.md) · [Authoring a module](./modules/authoring.md) · [Releasing](./development/releasing.md) |
| Run, debug, or extend the codebase            | [Getting Started](./development/getting-started.md) · [Script Lifecycle](./supermonkey/lifecycle.md) · [Authoring a module](./modules/authoring.md) · [Contributing](./development/contributing.md) |
| Look up a term                                | [Glossary](./glossary.md)                                                                                                                                                                           |

The sections below index every page in this documentation set.

## Integrations

| Document                                             | Description                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| [Using shipped integrations](./supermonkey/using-shipped.md) | First run, built-in badges, Share / Edit / Reset without TypeScript |
| [Integration editor](./integrations/editor-ui.md)    | Browser UI for creating, editing, importing, and sharing integrations |
| [End-to-end tutorial](./integrations/tutorial.md)    | Matching, mapped pages, Content Manager, History, CSS, optional modules |
| [Runtime signals](./integrations/runtime-signals.md) | Advanced console messages for matching, Content Manager, and module issues |
| [Integration DSL](./integrations/dsl.md)             | Stored shape, matchedDomains CSV, multi-host, path patterns               |
| [TypeScript integration](./integrations/README.md)   | Built-in TypeScript authoring, registration, and user storage         |
| [TypeScript API index](./integrations/typescript-api.md) | Public types and classes → source → narrative docs                |

## Modules

| Document                                                  | Description                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Modules overview](./modules/README.md)                   | Content Manager, static modules, and integration-configured feature modules |
| [Authoring a module](./modules/authoring.md)              | Subclass `Module`, register a constructor key, and compose an instance id   |
| [Content Manager](./modules/content-manager.md)           | Content groups, views, listings, scan mode, and events                      |
| [Additional Pages](./modules/additional-pages.md)         | Load extra listing pages and merge cards into the live document             |
| [Custom CSS](./modules/custom-css.md)                     | Always-on and user-configurable integration-authored page styles            |
| [JS Snippets](./modules/js-snippets.md)                   | Opt-in integration-authored page scripts on selected hooks                  |
| [History](./modules/history.md)                           | Listed/viewed content history, markers, hiding, and backup                  |
| [Keyboard Navigation](./modules/keyboard-navigation.md)   | Previous/next pager controls via keyboard shortcuts                         |
| [Resources Downloader](./modules/resources-downloader.md) | Map and download media inside Content Manager entries                       |
| [Configuration](./modules/configuration.md)               | Preference types, storage keys, style mixin, actions, and settings panel    |
| [Notification Bar](./modules/notification-bar.md)         | Static floating icon row and notification entries                           |
| [Integrations Menu](./modules/integrations-menu.md)       | Effective registry, active integration, row actions, and log level          |

## Utils

| Document                                            | Description                                           |
| --------------------------------------------------- | ----------------------------------------------------- |
| [Utils overview](./utils/README.md)                 | Shared extraction and other helpers                   |
| [Value source](./utils/value-source.md)             | Extract strings from the page or tab URL              |
| [Opts normalization](./utils/opts-normalization.md) | Shared `Normalized<T>` reject and repair contract     |
| [Page filter](./utils/page-filter.md)               | Allow/deny name lists for mapped pages and History    |
| [Event bus](./utils/event-bus.md)                   | Process-wide pub/sub for lifecycle and feature events |
| [Value storage](./utils/value-storage.md)           | Typed Tampermonkey reads, writes, and change watchers |
| [Logger](./utils/logger.md)                         | Console logger, levels, and `Logger.setLevel`         |

## Project

| Document                                                  | Description                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Overview](./supermonkey/overview.md)                     | Goals, stack, layout, and architecture map                                                              |
| [Installing Super Monkey](./supermonkey/installing.md)    | Install from GitHub Releases, then use shipped integrations or build locally |
| [Using shipped integrations](./supermonkey/using-shipped.md) | First run, active built-ins, and customize via Edit / Share / Reset       |
| [Getting Started](./development/getting-started.md)       | Clone, local setup, Tampermonkey install, and first-success checks                                      |
| [Releasing](./development/releasing.md)                   | Merge develop into main, SemVer bump labels, draft GitHub Release, and publish                          |
| [Script Lifecycle](./supermonkey/lifecycle.md)            | Bootstrap, component isolation, `INTEGRATION_LOADED`, `CONTENT_LOADED`, and `BEFORE_UNLOAD`             |
| [Contributing](./development/contributing.md)             | Development principles, definition of done, and documentation expectations                              |
| [Documentation Site](./development/documentation-site.md) | Docsify composition, page checklist, and local preview                                                  |
| [Editor Extensions](./development/editor-extensions.md)   | Recommended VS Code / Cursor extensions                                                                 |
| [Dev Container](./development/dev-container.md)           | Optional Node.js / pnpm Dev Container setup                                                             |
| [Debugging](./development/debugging.md)                   | Firefox `launch.json` and debug workflow; see also [Runtime signals](./integrations/runtime-signals.md) |
| [Glossary](./glossary.md)                                 | Definitions for integration, Content Manager, and module terms                                          |

Agent invariants live in `AGENTS.md` at the repository root.
