# Integration editor

The integration editor creates, updates, imports, exports, and removes integrations in the browser. Saved integrations live in Tampermonkey storage and override built-in integrations with the same name.

> **Browser path:** [Integrations Menu](../modules/integrations-menu.md) → **Create** / **Edit** / **Import** → configure domains, Content Manager, and module opts → **Save** → reload → confirm the **active** badge and [runtime signals](./runtime-signals.md). You do not need TypeScript for this path. Shipped built-ins: [Using shipped integrations](../supermonkey/using-shipped.md).

Open the editor from the [Integrations Menu](../modules/integrations-menu.md): use **Create** or **Import** in the footer, or choose an action on an integration row. The Configuration Menu does not expose editor shortcuts. The editor header **Help** control opens this documentation page in a new browser tab. New to the editor? Start with the [tutorial §0 — learn from a shipped built-in](./tutorial.md#0-learn-from-a-shipped-built-in-first).

## First integration

These steps assume Super Monkey is installed and running on an HTTP(S) page. Prefer [tutorial §0](./tutorial.md#0-learn-from-a-shipped-built-in-first) (Share a built-in) when a **`builtin`** row already matches your site.

1. Open the Tampermonkey menu and select **Open Integrations Menu**.
2. Select **Create** in the Integrations Menu footer.
3. Confirm the suggested **Name** and **Matched domains**, or replace them. The name must use only letters, digits, hyphens, and underscores.
4. Optionally configure [Content Manager](#content-manager) and [Modules](#modules).
5. Select **Save**. The editor stores the integration after [validation](#validation) succeeds.
6. Reload the tab so Super Monkey loads the stored integration.
7. Follow the [After Save checklist](#after-save-checklist).

Create mode suggests a name derived from the current hostname and enters that hostname in **Matched domains**.

## After Save checklist

1. Reload the page.
2. Open **Open Integrations Menu** and confirm the integration has the **active** badge (and the expected provenance: `user`, `builtin`, or `override`).
3. When Content Manager and History are configured, inspect matched entries in DevTools **Elements** for `data-sm-cm-*` and `data-sm-history` attributes.
4. If the menu does not show **active**, or markers are missing, use the console and [Runtime signals](./runtime-signals.md) (INFO `Matched integration:` and FATAL checks).

## Customize a matching integration

Use a shipped built-in as a working example: **Edit** → change fields → **Save** (creates an **override**) → **Share** to study the JSON → **Reset** or **Restore default** to return to the shipped definition.

1. Open **Open Integrations Menu**.
2. Select **Edit** on a built-in integration row.
3. Change its matched domains, Content Manager fields, or modules, then select **Save**.
4. Reload the tab to apply the stored override.
5. Select **Reset** on the override row, or **Restore default** in the editor, to remove the override and restore the built-in definition.
6. Optionally select **Share** before editing to download the effective JSON for reference.

## Atlas Library field map

Enter these values in editor order to build the Atlas Library integration:

1. In **Identity**, set **Name** to `atlas_library`.
2. In **Matched domains**, enter `atlas.example.com`. This CSV field contains one host.
3. Under **Mapped pages**, add:
   - **Name** `catalog`, **Paths**: `/catalog`, `/catalog/*`
   - **Name** `detail`, **Paths**: `/books/*`
4. In **Content Manager**, set **Scan mode** to `interval` and **Scan interval (ms)** to `1500`.
5. Add a group and set **Group name** to `books`.
6. Under **Views**, add a view:
   - **Name**: `detail`
   - **Page filter**: `detail`
   - **Selectors**: `main [data-book-id]`
   - **Source**: `Attribute`
   - **Attributes**: `data-book-id`
   - **Map steps**: leave empty
7. Under **Listings**, add a listing:
   - **Name**: `catalog`
   - **Page filter**: `catalog`
   - **Container selectors**: `.book-grid`
   - **Entry selectors**: `.book-card[data-book-id]`
   - **Entry container selectors**: leave empty
   - Under **Entry ID sources**, use the existing ID source.
   - **Source**: `Attribute`
   - **Attributes**: `data-book-id`
   - **Map steps**: leave empty
8. In **Modules**, add the History instance:
   - **Instance name**: `history_books`
   - **Module key**: `History`
   - **Group**: `books`
   - **Viewed styles**: `& { opacity: 0.55; }`
   - **Listed styles**: `& { outline: 2px solid #d6a700; }`
9. Select **Save**, reload the page, and verify that Atlas Library cards receive the expected History styling.

The editor converts comma-separated matched domains, attributes, mapped-page paths, and selector lists into arrays. Regex fields use one value per line. Value source **Map steps** serialize to an ordered `map` array; the label-to-value mapping is in [Value source - In the editor](../utils/value-source.md#in-the-editor).

### Id from href

When a card link contains the id in its `href` and the managed card is an ancestor of that link, configure the listing as follows:

1. Set **Container selectors** to `.feed`.
2. Set **Entry selectors** to `a.thumbnail`.
3. Set **Entry container selectors** to `.card`.
4. Under **Entry ID sources**, set **Source** to `Attribute` and **Attributes** to `href`.
5. Under **Map steps**, select **Add step** and enter:
   - **Step type**: `Extract (regex)`
   - **Regexes**: `[?&]v=([^&]+)`
   - **Capture group**: `1`

This produces an `entryIdSource` map step with `type: "extract"` and an `entryContainerSelector` value of `[".card"]`. See [Value source - In the editor](../utils/value-source.md#in-the-editor) for map-step fields and [Content Manager - Matching the id vs managing the card](../modules/content-manager.md#matching-the-id-vs-managing-the-card) for the listing structure.

## Entry points

- **Open Integrations Menu** from Tampermonkey opens the effective registry, provenance badges, row actions, log level, and the **Create** and **Import** actions.
- The static Integrations Menu icon or action opens the same menu while an integration is active.
- **Create** opens a new integration. **Edit** opens the selected row. **Share** exports the selected row.
- **Import** in the Integrations Menu or editor footer opens a JSON or plain-text file.

Foldable sections start collapsed except **Identity** in create mode and **Matched domains**. Nested mapped pages, groups, views, listings, modules, sources, and map steps also start collapsed. Adding a block expands it and its ancestors while collapsing sibling blocks. The footer provides **Expand all** and **Collapse all**.

## Matched domains

**Matched domains** is a comma-separated field that serializes to the `matchedDomains` array. Enter hostnames or hostname globs, and prefix exclusions with `!!`.

At least one positive pattern is required. Activation and pattern semantics are documented in [Integration DSL - Domain patterns](./dsl.md#domain-patterns).

## Mapped pages

**Mapped pages** is an optional foldable list of named pathname catalogs. Each page has:

- **Name** — unique id within the integration (`[A-Za-z0-9_-]+`).
- **Paths** — comma-separated pathname globs (`*` matches any substring). Prefix exclusions with `!!`.

Example stored shape:

```json
"mappedPages": [
  { "name": "home", "paths": ["/"] },
  { "name": "article", "paths": ["/article/*", "*/article/*"] },
  { "name": "comments", "paths": ["*/comments/*", "!!/post/*/comments/*"] }
]
```

Save requires a valid unique name and at least one valid **positive** path per page. At runtime, Super Monkey resolves which mapped-page names match the current pathname. Path syntax: [Integration DSL - Path patterns](./dsl.md#path-patterns).

## Content Manager

The **Content Manager** section configures optional page discovery:

- **Scan mode** and **Scan interval (ms)** control listing scans.
- **Groups** contain **Views** for one open item and **Listings** for collections of items.
- Every view and listing has a required **Name** used by History filters and other consumers.
- Optional **Page filter** (CSV of mapped page names; `!!` exclusions) gates when that view or listing runs.
- Views configure optional **Selectors** and one ID **Source**.
- Listings configure **Container selectors**, **Entry selectors**, optional **Entry container selectors**, ordered **Entry ID sources**, and optional cleanup.

Selectors and attribute names use CSV. The complete labels and JSON shapes are in [Content Manager - In the editor](../modules/content-manager.md#in-the-editor), and source and **Map steps** fields are in [Value source - In the editor](../utils/value-source.md#in-the-editor).

## Modules

Each module entry contains:

- A unique **Instance name** using letters, digits, hyphens, and underscores.
- A **Module key** dropdown of registered feature constructors.
- Module options: a **typed form** for every registered module key (`AdditionalPages`, `CustomCss`, `History`, `JsSnippets`, `KeyboardNavigation`, `ResourcesDownloader`).

Registered module keys:

| Module key            | Options reference                                                             |
| --------------------- | ----------------------------------------------------------------------------- |
| `AdditionalPages`     | [Additional Pages](../modules/additional-pages.md#in-the-editor-pattern-a)    |
| `CustomCss`           | [Custom CSS](../modules/custom-css.md#in-the-editor-pattern-a)                |
| `History`             | [History](../modules/history.md#in-the-editor-pattern-a)                      |
| `JsSnippets`          | [JS Snippets](../modules/js-snippets.md#in-the-editor-pattern-a)              |
| `KeyboardNavigation`  | [Keyboard Navigation](../modules/keyboard-navigation.md#in-the-editor-pattern-a) |
| `ResourcesDownloader` | [Resources Downloader](../modules/resources-downloader.md#in-the-editor-pattern-a) |

Renaming or removing an instance can rename or purge its Tampermonkey configuration keys after confirmation. The editor preserves the optional opaque `defaults` object when editing or importing an integration.

## Built-ins and stored integrations

Shipped built-ins appear with provenance `builtin`. Editing and saving one creates an **override**. **Share** downloads the effective JSON so you can study a working configuration. **Reset** / **Restore default** returns to the shipped definition.

| Provenance | Meaning                                             | Row actions         |
| ---------- | --------------------------------------------------- | ------------------- |
| `builtin`  | Shipped definition only                             | Edit, Share         |
| `user`     | Stored definition only                              | Edit, Share, Delete |
| `override` | Stored definition replaces a built-in with its name | Edit, Share, Reset  |

Saving an edited built-in creates a stored override. **Reset** or **Restore default** removes that override and restores the built-in. **Delete** removes a user-only integration. Destructive changes request confirmation when module configuration keys must also be removed.

## Import and export

**Share** downloads the effective integration as `${name}-sm-integration.json`. **Import** reads JSON, validates the stored `Integration` shape, and writes it to storage.

```json
{
  "name": "xpto_platform",
  "matchedDomains": ["xpto.com", "www.xpto.com"],
  "modules": {
    "history_main": {
      "module": "History",
      "opts": {
        "group": "posts"
      }
    }
  }
}
```

Optional top-level `contentManager` and `defaults` fields follow their owning contracts ([Content Manager](../modules/content-manager.md), module consumers of `defaults`). Import uses the JSON `matchedDomains` array. When the name already exists, Import asks before replacing it. Canceling the file picker or selecting an empty file shows an alert and does not open the editor. Invalid JSON or a draft that fails validation opens a populated Create editor with validation issues.

## Validation

`validateIntegration` runs on **Save** and **Import**. Storage changes only when validation succeeds. The editor persists the normalized integration value (Content Manager and module opts after their normalizers). Runtime may still repair stored data on load; the editor does not save when any normalize finding remains.

| Check            | Rule                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `name`           | Valid id segment; create mode also rejects an existing effective name.                                       |
| `matchedDomains` | At least one valid positive domain pattern after whitespace and `!!` normalization.                          |
| `mappedPages`    | Each page has a unique valid id and at least one valid positive pathname glob (optional `!!` exclusions). |
| `contentManager` | Normalization must produce a value; every finding (reject or repair) blocks Save.                          |
| `modules`        | Instance ids are valid and unique, the module key is registered, and present opts pass module normalization with no findings. Typed forms must not omit incomplete rows; they return field issues instead. |
| `defaults`       | Plain object when present.                                                                                   |

Failed checks produce footer issues and highlight the matching editor control (`data-path`) plus foldable ancestors up to the panel body. Each footer item focuses its control when clicked. Typed module forms map to the same `opts` objects as storage and TypeScript; normalization still runs at Save.

## Editor sections

The browser editor is a shell plus ordered body sections. The shell owns open/close, footer actions, Save validation, and storage. Each section mounts its own fields into a host under the panel body and mutates the shared draft.

| Order | Section id         | Role                                      |
| ----- | ------------------ | ----------------------------------------- |
| 10    | `identity`         | Integration name (Create mode only)       |
| 20    | `matched-domains`  | Hostname globs                            |
| 30    | `mapped-pages`     | Named pathname globs                      |
| 40    | `content-manager`  | Scan mode, groups, views, listings       |
| 50    | `modules`          | Module instances and typed opts forms     |

Browser authors configure these sections in the panel. The table is the field map; you do not need the repository for everyday Create / Edit / Save.

### Contributors

Built-in sections live under `src/supermonkey/integrations/editor/sections/` and register through `EditorSectionRegistry` (same idea as `ModuleLoader` module keys).

To add a first-party section: create a file under `sections/`, implement `EditorSection` (`id`, `title`, `order`, optional `visible`, `mount`), call `EditorSectionRegistry.register`, and import the file from `sections/register-builtin-sections.ts`. Use `EditorUiHelpers` from the mount context for fields and list blocks. Save and validation stay in the shell (`draftToIntegration` / `validateIntegration`).

Editor implementation: `src/supermonkey/integrations/editor/`. Shipped built-ins in TypeScript: [Register a built-in integration](./README.md#register-a-built-in-integration).

## Related

- [End-to-end tutorial](./tutorial.md)
- [Runtime signals](./runtime-signals.md)
- [Integration DSL](./dsl.md)
- [TypeScript integration](./README.md)
- [Content Manager](../modules/content-manager.md)
- [Value source](../utils/value-source.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Authoring a module](../modules/authoring.md)
- [Integrations Menu](../modules/integrations-menu.md)
