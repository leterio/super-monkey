# Tutorial: Build a complete integration

> **Browser path:** [Install](../supermonkey/installing.md) → open a [shipped built-in](../supermonkey/using-shipped.md) → **Share** (learn the JSON) → [Integrations Menu](../modules/integrations-menu.md) → [Integration editor](./editor-ui.md) → Content Manager + module opts → **Save** → reload → [Verify](#verify-the-result). TypeScript registration is only under [TypeScript / coded built-in authors](#typescript--coded-built-in-authors).

## Prefer a real site first

**First success (minimum):** one hostname, one Content Manager listing or view, History with **Group** set to that group — skip mapped pages until activation works. Full steps: [Apply the same process to a real site](#apply-the-same-process-to-a-real-site).

When your build lists a **Built-in** (`builtin`) row, [§0](#0-learn-from-a-shipped-built-in-first) (Share → optional one-field Edit) is the fastest way to learn Options JSON without inventing selectors.

Atlas Library below is a **worked field-map example** (`atlas.example.com` is fictional). Use it to see mapped pages, page filters, and a complete JSON shape — then replace the domain and selectors on a live tab.

## 0. Learn from a shipped built-in first

When your build lists a **`builtin`** row in the [Integrations Menu](../modules/integrations-menu.md):

1. Open a matching host for that row (hosts: release notes, or **Share** / **Edit** on the row).
2. Select **Share** and save the JSON.
3. Note `matchedDomains`, any `mappedPages`, `contentManager`, and module **Options** objects.
4. Optionally **Edit** → change one field → **Save** → reload → confirm provenance **`override`**, then **Reset**.

If the menu has no **`builtin`** rows yet, skip this section and continue with Atlas, or create an integration in the [editor](./editor-ui.md). Details: [Using shipped integrations](../supermonkey/using-shipped.md).

Enter Atlas values with the [Atlas Library field map](./editor-ui.md#atlas-library-field-map), or import the [final stored JSON](#final-stored-json).

## Service model

Atlas Library uses these URLs and elements (fictional host — replace on a real site):

- `https://atlas.example.com/catalog` and nested catalog paths show book cards inside `.book-grid`.
- `https://atlas.example.com/books/atlas-shrugged` shows one book inside `main [data-book-id]`.
- Each book card is `.book-card[data-book-id]`.
- The `data-book-id` attribute contains the stable book id on both page types.

## 1. Match the service

Name the integration `atlas_library` and add `atlas.example.com` to **Matched domains**. The editor stores this field as `matchedDomains` and activates the integration on that host.

See [Matched domains](./editor-ui.md#matched-domains) for the editor format and validation rules.

## 2. Map pathnames (mapped pages)

Add two [mapped pages](./editor-ui.md#mapped-pages):

| Name | Paths (CSV) |
| ---- | ----------- |
| `catalog` | `/catalog`, `/catalog/*` |
| `detail` | `/books/*` |

These names feed Content Manager **Page filter** fields in the next step. Path globs: [Integration DSL - Path patterns](./dsl.md#path-patterns).

## 3. Map books with Content Manager

Create a Content Manager group named `books`. Set **Scan mode** to `interval` and **Scan interval (ms)** to `1500` so dynamically added catalog cards are discovered.

Add one view for open book pages:

- **Name**: `detail`
- **Page filter**: `detail`
- **Selectors**: `main [data-book-id]`
- **Source**: `Attribute`
- **Attributes**: `data-book-id`

Add one listing for catalog pages:

- **Name**: `catalog`
- **Page filter**: `catalog`
- **Container selectors**: `.book-grid`
- **Entry selectors**: `.book-card[data-book-id]`
- **Entry ID sources**: `Attribute`
- **Attributes**: `data-book-id`

The listing runs on catalog paths; the view runs on book detail paths. See [Page filter](../modules/content-manager.md#page-filter).

The group and mapping fields follow the [Content Manager editor field reference](../modules/content-manager.md#editor-field-reference). Review [Groups](../modules/content-manager.md#groups), [Views](../modules/content-manager.md#views), [Listings](../modules/content-manager.md#listings), and [Scan mode](../modules/content-manager.md#scan-mode) for their runtime behavior. Attribute extraction follows [Value source - In the editor](../utils/value-source.md#in-the-editor).

## 4. Track and style book history

Add a module instance named `history_books` with module key `History`. In the typed form, set **Group** to `books` and optional **Viewed styles** / **Listed styles**:

- **Group**: `books`
- **Viewed styles**: `& { opacity: 0.55; }`
- **Listed styles**: `& { outline: 2px solid #d6a700; }`

The same Options object (for Share / Import) is:

```json
{
  "group": "books",
  "viewedStyles": "& { opacity: 0.55; }",
  "listedStyles": "& { outline: 2px solid #d6a700; }"
}
```

History records listed and viewed ids from that Content Manager group. Its configuration controls can hide or decorate previously seen books. See [History - In the editor](../modules/history.md#in-the-editor-pattern-a) and [Decoration styles](../modules/history.md#decoration-styles).

## 5. Optional - Additional Pages (Pattern A)

When the catalog has a “next” control, add a module instance with key `AdditionalPages`. Prefer the typed form: under group `books`, set a DOM context manager with paginator **Root containers** `.pager` and **Next selectors** `.pager-next`, and paging strategy **next-link**. Replace selectors with values from the live site.

Share / Import Options reference:

```json
{
  "groups": {
    "books": {
      "contextManager": {
        "type": "dom",
        "paginatorSelectors": {
          "rootContainers": [".pager"],
          "nextSelectors": [".pager-next"]
        }
      },
      "pagingStrategy": { "type": "next-link" }
    }
  }
}
```

The `books` key matches the Content Manager group created earlier. After Save and reload, open Configuration and set **Pages to Load (books)** above **`0`** (default `0` fetches nothing). Walkthrough: [Additional Pages - In the editor](../modules/additional-pages.md#in-the-editor-pattern-a).

## 6. Optional - Resources Downloader (leaf)

When each book card has a clear image URL attribute, add a module instance with key `ResourcesDownloader`. Prefer the typed form: add mapping **cover**, type **leaf**, selectors `.book-card img`, URL sources `src` / `data-src`. Replace selectors and attributes for the live site.

Share / Import Options reference:

```json
{
  "mappings": {
    "cover": {
      "type": "leaf",
      "selectors": [".book-card img"],
      "urlSources": ["src", "data-src"]
    }
  }
}
```

After reload, confirm download controls on cards. Walkthrough: [Resources Downloader - In the editor](../modules/resources-downloader.md#in-the-editor-pattern-a).

## 7. Optional - Keyboard Navigation

When the catalog exposes prev/next controls, add a module instance with key `KeyboardNavigation`. Prefer the typed form: **Previous selectors** `.pager-prev`, `a[rel='prev']` and **Next selectors** `.pager-next`, `a[rel='next']`. Replace selectors for the live site.

Share / Import Options reference:

```json
{
  "previousSelectors": [".pager-prev", "a[rel='prev']"],
  "nextSelectors": [".pager-next", "a[rel='next']"]
}
```

After reload, enable a key pair in Configuration and press next. Walkthrough: [Keyboard Navigation - In the editor](../modules/keyboard-navigation.md#in-the-editor-pattern-a).

Also available in the editor **Modules** panel (not stepped above): [Custom CSS](../modules/custom-css.md#in-the-editor-pattern-a) and [JS Snippets](../modules/js-snippets.md#in-the-editor-pattern-a).

## Final stored JSON

Save this object as `atlas_library-sm-integration.json` to import it through the editor:

```json
{
  "name": "atlas_library",
  "matchedDomains": ["atlas.example.com"],
  "mappedPages": [
    { "name": "catalog", "paths": ["/catalog", "/catalog/*"] },
    { "name": "detail", "paths": ["/books/*"] }
  ],
  "contentManager": {
    "scanMode": "interval",
    "scanIntervalMs": 1500,
    "groups": {
      "books": {
        "views": [
          {
            "name": "detail",
            "pageFilter": ["detail"],
            "selectors": ["main [data-book-id]"],
            "idSource": {
              "source": "attribute",
              "attributes": ["data-book-id"]
            }
          }
        ],
        "listings": [
          {
            "name": "catalog",
            "pageFilter": ["catalog"],
            "containerSelectors": [".book-grid"],
            "entriesSelectors": [".book-card[data-book-id]"],
            "entryIdSource": [
              {
                "source": "attribute",
                "attributes": ["data-book-id"]
              }
            ]
          }
        ]
      }
    }
  },
  "modules": {
    "history_books": {
      "module": "History",
      "opts": {
        "group": "books",
        "viewedStyles": "& { opacity: 0.55; }",
        "listedStyles": "& { outline: 2px solid #d6a700; }"
      }
    }
  }
}
```

The [integration editor import flow](./editor-ui.md#import-and-export) validates the object before storing it.

## Verify the result

After adapting the Atlas values to a real site (or importing the JSON as-is on a page you control):

1. Import the JSON from the Integrations Menu, save it, and reload the page.
2. Open the Integrations Menu and confirm that `atlas_library` appears as the **active** stored integration.
3. On `/catalog`, confirm listing cards get Content Manager markers; on `/books/...`, confirm the detail view records History. Open DevTools **Elements** (usually **F12** or right-click → Inspect) and look for `data-sm-cm-*` on matched nodes and `data-sm-history` when History applies.
4. Open a book detail page and confirm its stable id is recorded as viewed.
5. Return to the catalog and confirm the viewed or listed style applies to the corresponding card.
6. If activation, discovery, or module loading fails, use the console and the symptom checklist in [Runtime signals](./runtime-signals.md) (try without DEBUG first: active → Elements → then console).

## Apply the same process to a real site

**First success (minimum):** one hostname, one Content Manager listing or view, History `{"group":"..."}` — skip mapped pages until activation works. (Also introduced after [§0](#0-learn-from-a-shipped-built-in-first).)

1. Open the live site and DevTools **Elements** (F12). Identify a stable id attribute or href pattern for one content kind.
2. Copy CSS selectors for the listing container, entry nodes, and (if needed) the open-item node.
3. In the editor, set **Matched domains** to the current hostname (one host is enough).
4. Create a Content Manager **group**, then one **listing** or **view** with those selectors and an ID source.
5. Add a History instance with **Group** equal to that group name (optional: `viewedStyles` / `listedStyles` with `&`).
6. **Save**, reload, confirm **active**, and check Elements for `data-sm-cm-*` / `data-sm-history` when History applies.
7. When that works, add [Mapped pages](./editor-ui.md#mapped-pages) and **Page filter** if the site needs feed vs detail separation; then optional Additional Pages / Resources Downloader / Keyboard Navigation (Custom CSS / JS Snippets via the Modules panel).
8. Re-run [Verify the result](#verify-the-result). Use [After Save](./editor-ui.md#after-save-checklist) and [Runtime signals](./runtime-signals.md) when something does not activate.

## TypeScript / coded built-in authors

This section is for authors who ship or maintain coded built-ins in a clone or fork (including non-maintainers). Browser users can stop after Verify.

Built-in integrations use the same domain array, mapped pages, and mapping names:

```ts
import { ScanMode } from "../../content-manager/metadata";
import { Integration } from "../metadata";

export const ATLAS_LIBRARY_INTEGRATION: Integration = {
  name: "atlas_library",
  matchedDomains: ["atlas.example.com"],
  mappedPages: [
    { name: "catalog", paths: ["/catalog", "/catalog/*"] },
    { name: "detail", paths: ["/books/*"] },
  ],
  contentManager: {
    scanMode: ScanMode.INTERVAL,
    scanIntervalMs: 1500,
    groups: {
      books: {
        views: [
          {
            name: "detail",
            pageFilter: ["detail"],
            selectors: ["main [data-book-id]"],
            idSource: {
              source: "attribute",
              attributes: ["data-book-id"],
            },
          },
        ],
        listings: [
          {
            name: "catalog",
            pageFilter: ["catalog"],
            containerSelectors: [".book-grid"],
            entriesSelectors: [".book-card[data-book-id]"],
            entryIdSource: [
              {
                source: "attribute",
                attributes: ["data-book-id"],
              },
            ],
          },
        ],
      },
    },
  },
  modules: {
    history_books: {
      module: "History",
      opts: {
        group: "books",
        viewedStyles: "& { opacity: 0.55; }",
        listedStyles: "& { outline: 2px solid #d6a700; }",
      },
    },
  },
};
```

Follow [Register a built-in integration](./README.md#register-a-built-in-integration) to add the constant to `BuiltinIntegrations`.

## Related

- [Using shipped integrations](../supermonkey/using-shipped.md)
- [Integration editor](./editor-ui.md)
- [Content Manager](../modules/content-manager.md)
- [History](../modules/history.md)
- [Custom CSS](../modules/custom-css.md)
- [Additional Pages](../modules/additional-pages.md)
- [Resources Downloader](../modules/resources-downloader.md)
- [Keyboard Navigation](../modules/keyboard-navigation.md)
- [Value source](../utils/value-source.md)
- [Runtime signals](./runtime-signals.md)
- [Register a built-in integration](./README.md#register-a-built-in-integration)
