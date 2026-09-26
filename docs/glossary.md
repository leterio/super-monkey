# Glossary

Affirmative definitions for terms used across Super Monkey documentation. Each entry links to the canonical page for that concept.

| Term | Definition |
|------|------------|
| **Userscript** | A small script a browser extension (such as Tampermonkey) runs on matching web pages. Super Monkey installs as a userscript. See [Installing Super Monkey](./supermonkey/installing.md). |
| **Tampermonkey** | The primary userscript manager Super Monkey targets. It installs the `.user.js` file and exposes **Open Integrations Menu**. See [Installing Super Monkey](./supermonkey/installing.md). |
| **Integration** | A named configuration for one logical service: `matchedDomains`, optional mapped pages, Content Manager, and modules. Create or edit one in the [Integration editor](./integrations/editor-ui.md), or follow the [end-to-end tutorial](./integrations/tutorial.md). |
| **Built-in integration** | An integration that ships with Super Monkey (provenance `builtin` in the Integrations Menu). End users activate it by opening a matching site. Authors register built-ins in TypeScript — [Register a built-in integration](./integrations/README.md#register-a-built-in-integration). Everyday use: [Using shipped integrations](./supermonkey/using-shipped.md). |
| **Provenance** | How an integration entered the effective registry: `builtin`, `user`, or `override`. Shown as a badge in the [Integrations Menu](./modules/integrations-menu.md). |
| **Active** | Badge on the Integrations Menu row whose name is the integration loaded on the current tab. See [Integrations Menu](./modules/integrations-menu.md). |
| **Override** | A stored integration that replaces a built-in with the same `name`. Create it by editing a built-in; remove it with **Reset**. See [Customize a matching integration](./integrations/editor-ui.md#customize-a-matching-integration). |
| **Stored integration** | A user-authored integration in Tampermonkey storage. Create and edit in the [Integration editor](./integrations/editor-ui.md). Storage rules: [User storage](./integrations/README.md#user-storage). |
| **Matched domains** | The `matchedDomains` array (or editor CSV field): hostname globs and optional `!!` negations that activate the integration. See [Integration DSL](./integrations/dsl.md) and [Matched domains](./integrations/editor-ui.md#matched-domains). |
| **Mapped pages** | Optional named pathname catalogs (`mappedPages`: `name` + path globs). Active names depend on the current URL path. See [Mapped pages](./integrations/editor-ui.md#mapped-pages), [Mapped pages (TypeScript)](./integrations/README.md#mapped-pages-typescript), and [Path patterns](./integrations/dsl.md#path-patterns). |
| **Page filter** | Optional `pageFilter` on a Content Manager view/listing or Resources Downloader mapping that gates scans against active mapped-page names (`!!` exclusions supported). See [Page filter](./utils/page-filter.md). |
| **Module opts** | Typed editor fields for a module instance’s `opts` (storage and TypeScript still use a JSON object). See module pages linked from [Modules overview](./modules/README.md#configure-in-the-browser). |
| **Scan mode** | Content Manager setting (`onload` or `interval`) that controls when listings are discovered. See [Scan mode](./modules/content-manager.md#scan-mode). |
| **Module key** | Constructor name in the editor dropdown (for example `History`, `CustomCss`) registered in `ModuleLoader`. See [Modules overview](./modules/README.md). |
| **Instance name** | Unique id for one module entry under `integration.modules` (letters, digits, hyphens, underscores). See [Integration editor - Modules](./integrations/editor-ui.md#modules). |
| **Group** | A named content kind under `contentManager.groups`; views and listings in the same group share one stable id namespace. See [Groups](./modules/content-manager.md#groups). |
| **View** | A Content Manager config that resolves **one open item** from the tab URL or a selected DOM node. See [Views](./modules/content-manager.md#views). |
| **Listing** | A Content Manager config that discovers **many items** inside containers on the page. See [Listings](./modules/content-manager.md#listings). |
| **Name** | The required stable `name` on a view or listing; downstream features filter on it in event payloads. See [Views](./modules/content-manager.md#views) and [Listings](./modules/content-manager.md#listings). |
| **Module** | A feature class registered under a constructor key (for example `CustomCss`, `History`). See [Modules overview](./modules/README.md). |
| **Module instance** | One enabled feature constructed from `integration.modules` with a module key and `opts`. See [Authoring a module](./modules/authoring.md). |
| **Static module** | A module that loads with every active integration and is **not** listed under `integration.modules` (Notification Bar, Configuration Menu, Integrations Menu). See [Modules overview](./modules/README.md). |
| **Value source** | A declarative rule for reading a string from the DOM or the tab URL. See [Value source](./utils/value-source.md). |
| **History** | A feature module (`module: "History"`) that tracks listed and viewed content ids for a Content Manager group. See [History](./modules/history.md). |
| **EventBus** | Shared pub/sub used so lifecycle-aware components react without importing each other. Contract: [Event bus](./utils/event-bus.md). See also [Script Lifecycle](./supermonkey/lifecycle.md). |
| **Component** | Base type for lifecycle-aware pieces that subscribe to EventBus hooks. See [Script Lifecycle](./supermonkey/lifecycle.md). |
| **INTEGRATION_LOADED** | Lifecycle event published after the matched integration’s Content Manager and modules are ready. See [Script Lifecycle](./supermonkey/lifecycle.md). |
| **CONTENT_LOADED** | Lifecycle event owned by Content Manager when a document is ready to scan (live tab or foreign). See [Content Manager](./modules/content-manager.md) and [Script Lifecycle](./supermonkey/lifecycle.md). |
| **BEFORE_UNLOAD** | Lifecycle event published before the page unloads so modules can clean up. See [Script Lifecycle](./supermonkey/lifecycle.md). |
