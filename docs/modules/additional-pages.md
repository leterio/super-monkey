# Additional Pages

Additional Pages (`module: "AdditionalPages"`) loads more listing result pages and merges their cards into the live document through Content Manager events.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `AdditionalPages`, add one binder per Content Manager group, and fill its context manager, paging strategy, and selectors. Events and listings: [Content Manager](./content-manager.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page       | Reference                                                                 |
| ------------------ | ------------------------------------------------------------------------- |
| Editor options     | [Options shape](#options-shape)                                           |
| Editor walkthrough | [In the editor (Pattern A)](#in-the-editor-pattern-a)                     |
| TypeScript wiring  | [TypeScript wiring](#typescript-wiring)                                   |
| Prerequisites      | [Before you enable it](#before-you-enable-it)                             |
| Choosing strategy  | [Pick a paging shape](#pick-a-paging-shape)                               |
| Full opts          | [What you configure](#what-you-configure)                                 |
| DOM paginator      | [Context manager: dom](#context-manager-dom)                              |
| URL-only paging    | [Context manager: url](#context-manager-url)                              |
| Building page URLs | [URL templates](#url-templates) · [Paging strategies](#paging-strategies) |
| User-facing knobs  | [Runtime configurations](#runtime-configurations)                         |
| Opts walk          | [Normalization](#normalization)                                           |

## Options shape

Stored and TypeScript integrations use this opts object (`module: "AdditionalPages"`). The browser editor exposes the same fields as typed controls (selector lists, URL attributes, loaded page class names, and page filters use CSV). Each group binder keeps the Content Manager group name, the page filter, and the context/paging type selects visible; detail fields live in foldable **Context manager**, **Paging strategy** (numbered strategies only), and **Page request** sections that start collapsed.

**Pattern A - Follow the “next” link:**

```json
{
  "groups": {
    "items": {
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

**Pattern B - Numbered pages in the URL:**

```json
{
  "groups": {
    "items": {
      "contextManager": {
        "type": "dom",
        "urlTemplate": "/list?page={{NUMBER}}",
        "paginatorSelectors": {
          "rootContainers": [".pager"],
          "previousSelectors": [".pager-prev"],
          "nextSelectors": [".pager-next"],
          "pageIndexes": [".pager-page"]
        }
      },
      "pagingStrategy": { "type": "incremental" }
    }
  }
}
```

Each key under `groups` is the exact name of a Content Manager group. A binder runs only when that group's listing matches the current document (including the listing `pageFilter`) and the binder's own `pageFilter` passes. See [Page filter](#page-filter).

**Two Content Manager groups:**

```json
{
  "groups": {
    "items": {
      "contextManager": {
        "type": "dom",
        "paginatorSelectors": {
          "rootContainers": [".items-pager"],
          "nextSelectors": [".items-next"]
        }
      },
      "pagingStrategy": { "type": "next-link" }
    },
    "offers": {
      "contextManager": {
        "type": "url",
        "urlTemplate": "/offers?page={{NUMBER}}"
      },
      "pagingStrategy": { "type": "incremental" }
    }
  }
}
```

The `items` and `offers` keys match Content Manager group names. A binder runs when that group's listing context is active and the binder `pageFilter` passes. How many pages to load is a per-group **user** preference in the Configuration Menu - see [Runtime configurations](#runtime-configurations). Full field tables: [What you configure](#what-you-configure).

## In the editor (Pattern A)

1. Confirm Content Manager already has a **listing** for each group you want to extend ([Content Manager - In the editor](./content-manager.md#in-the-editor)).
2. In **Modules**, add an instance with **Module key** `AdditionalPages`.
3. Under **Groups**, add a group binder and set **Content Manager group name** to the exact group key, such as `items`. Optional **Page filter** limits that binder to mapped-page names (comma-separated; prefix exclusions with `!!`). Leave it empty to run on every page.
4. Set **Context manager type** to `DOM paginator` and **Paging strategy type** to `Next link`.
5. Expand **Context manager** and set **Root containers** to `.pager` and **Next selectors** to `.pager-next` (comma-separated when listing more than one), or match Pattern B from [Options shape](#options-shape) (open **Paging strategy** for numbering options when using incremental/decremental). Expand **Page request** only when you need HTTP method or headers overrides. Repeat for other groups.
6. Save, reload on a listing page, open Configuration, and set **Pages to Load (`groupKey`)** above **`0`** for the groups you want to fetch. Each preference defaults to `0` ([Runtime configurations](#runtime-configurations)).
7. Confirm new cards appear in the listing and receive Content Manager markers. If **Save** fails validation, fix the opts fields - `validateIntegration` runs Additional Pages opts normalization at Save time ([editor validation](../integrations/editor-ui.md#validation)).
8. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md) - unknown module key, rejected opts at load, or constructor failure skips that instance.

## TypeScript wiring

Register the constructor key `AdditionalPages` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "AdditionalPages"` and the opts below. Source: `src/supermonkey/modules/additional-pages/`.

**Pattern A - Follow the “next” link:**

```ts
modules: {
  additionalPages: {
    module: "AdditionalPages",
    opts: {
      groups: {
        items: {
          contextManager: {
            type: "dom",
            paginatorSelectors: {
              rootContainers: [".pager"],
              nextSelectors: [".pager-next"],
            },
          },
          pagingStrategy: { type: "next-link" },
        },
      },
    },
  },
},
```

**Pattern B - Numbered pages in the URL:**

```ts
modules: {
  additionalPages: {
    module: "AdditionalPages",
    opts: {
      groups: {
        items: {
          contextManager: {
            type: "dom",
            urlTemplate: "/list?page={{NUMBER}}",
            paginatorSelectors: {
              rootContainers: [".pager"],
              previousSelectors: [".pager-prev"],
              nextSelectors: [".pager-next"],
              pageIndexes: [".pager-page"],
            },
          },
          pagingStrategy: { type: "incremental" },
        },
      },
    },
  },
},
```

How many pages to load is a per-group **user** preference in the Configuration Menu - see [Runtime configurations](#runtime-configurations). Full field tables: [What you configure](#what-you-configure).

## Before you enable it

Additional Pages only merges **listing** content. The active integration defines a usable `contentManager` with a listing group for each key under `opts.groups`. Without Content Manager, the module skips fetching.

Listing discovery and inject rules live on Content Manager - configure containers, entry selectors, and `entryIdSource` there first. See [Content Manager - Listings](./content-manager.md#listings).

`ModuleLoader` runs `normalizeAdditionalPagesOpts` before construction. The `groups` map must contain at least one usable binder. Normalization drops unusable binders and repairs recoverable nested fields; the opts reject when none remain.

Additional Pages overrides `onContentLoaded` (live tab only) to start fetching. On `BEFORE_UNLOAD`, when a load session is active or any page is fetching, it calls `notifyPendingOperations()` so the browser can prompt before leaving - see [Script Lifecycle - BEFORE_UNLOAD](../supermonkey/lifecycle.md#before_unload).

## Minimum viable setup

Two decisions drive the opts: **how the site exposes “current page”** (DOM pager vs URL only) and **how the next page URL is obtained** (follow next link vs compose from a number template). Use the matching fields in the editor from [Options shape](#options-shape), or use [TypeScript wiring](#typescript-wiring) for built-ins.

### Pattern A - Follow the “next” link

Use when the paginator has a reliable next control and you do not need to invent URLs. Requires `contextManager.type: "dom"` and non-empty `nextSelectors`. Does not need `urlTemplate`.

### Pattern B - Numbered pages in the URL

Use when each page is a predictable path or query (for example `/page/2` or `?page=2`) and you want to fetch N pages ahead. Requires a valid [URL template](#url-templates) with `{{NUMBER}}` on the context manager. `"decremental"` swaps next/previous numbering when lower numbers are later pages.

## Pick a paging shape

| Site behavior                                             | `contextManager.type` | `pagingStrategy.type`              | You must set                                          |
| --------------------------------------------------------- | --------------------- | ---------------------------------- | ----------------------------------------------------- |
| Paginator “Next” link is trustworthy                      | `"dom"`               | `"next-link"`                      | `paginatorSelectors.rootContainers` + `nextSelectors` |
| Page number lives in the path/query; site has a DOM pager | `"dom"`               | `"incremental"` or `"decremental"` | `urlTemplate` + `paginatorSelectors.rootContainers`   |
| Page number lives only in the URL (no usable pager DOM)   | `"url"`               | `"incremental"` or `"decremental"` | `urlTemplate`                                         |

`"next-link"` is incompatible with `contextManager.type: "url"` (there is no next control to read).

`"url"` never updates DOM paginator pointers (there is no pager under that manager).

## What you configure

Top-level opts on the module wiring (`AdditionalPagesOpts`):

| Field    | Required | What you set                                                                  |
| -------- | -------- | ----------------------------------------------------------------------------- |
| `groups` | yes      | Map of exact Content Manager group key to one usable group binder (see below) |

Each value under `groups` is a binder:

| Field             | Required | What you set                                                                    |
| ----------------- | -------- | ------------------------------------------------------------------------------- |
| `contextManager`  | yes      | Discriminated object: `type` `"dom"` or `"url"` (see below)                     |
| `pagingStrategy`  | yes      | Discriminated object: `type` `"next-link"`, `"incremental"`, or `"decremental"` |
| `pageFilter`      | no       | Optional mapped-page names that gate this binder. Empty or omitted runs on every page. See [Page filter](#page-filter) |
| `pageRequestOpts` | no       | Optional HTTP overrides for this group's requests (`method`, `headers`, `sendReferer`) |

Each page request sends `Referer` set to the open tab's origin, including requests for later pager pages, when `sendReferer` is omitted or `true`. `sendReferer: false` leaves that header off. A `Referer` entry in `headers` is the value sent for that group.

How many pages to load and delays are **user** preferences in the Configuration Menu - see [Runtime configurations](#runtime-configurations). They are not integration opts.

## Page filter

Each group binder may set `pageFilter` against the integration's [mapped pages](../integrations/editor-ui.md#mapped-pages) ([TypeScript](../integrations/README.md#mapped-pages-typescript)). On each load run, Super Monkey keeps binders whose Content Manager listing matches the document, then skips any remaining binder that fails its own filter.

Rules and `!!` exclusions: [Page filter](../utils/page-filter.md). Content Manager listings use the same helper — [Content Manager - Page filter](./content-manager.md#page-filter). Both filters apply: the listing `pageFilter` is part of `hasListingContext`, and the binder `pageFilter` is a second gate.

```json
{
  "contextManager": {
    "type": "dom",
    "paginatorSelectors": {
      "rootContainers": [".pager"],
      "nextSelectors": [".pager-next"]
    }
  },
  "pagingStrategy": { "type": "next-link" },
  "pageFilter": ["catalog", "!!settings"]
}
```

Spell mapped-page names exactly as defined under **Mapped pages**. A typo in `pageFilter` never matches, so an allowlist with an unknown name skips that binder on every URL.

## Context manager: `dom`

Use when the page shows a pager you can select in the DOM.

| Field                | Required | What you set                                                                                                                        |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`               | yes      | `"dom"`                                                                                                                             |
| `paginatorSelectors` | yes      | Selector map for pager roots and controls (table below)                                                                             |
| `urlTemplate`        | no\*     | Pattern with `{{NUMBER}}`, a query-param value source whose `key` is the page parameter, or a `pathSuffix`                          |
| `ignoreLastPage`     | no       | When `true`, numbered strategies build the configured page count even when page indexes are missing, empty, or do not show the real last page. When omitted or `false`, those strategies fetch further pages only when page-index numbers resolve a last page |

\* Required when `pagingStrategy` is `"incremental"` or `"decremental"`.

### `paginatorSelectors`

| Field                  | Required | What you set                                                                                                                     |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `rootContainers`       | yes      | Non-empty `string[]` - each match is one pager root                                                                              |
| `previousSelectors`    | no       | Previous control, scoped under each root                                                                                         |
| `nextSelectors`        | no\*     | Next control (`"next-link"` requires a non-empty value)                                                                          |
| `currentSelectors`     | no       | Current-page indicator inside the pager                                                                                          |
| `pageIndexes`          | no       | Numbered page links inside the pager (used for `totalPages` and as the match for page-number / URL resolution)                   |
| `pageIndexDecoration`  | no       | Where status attributes and loaded classes attach relative to each `pageIndexes` match (table below)                             |
| `urlAttributes`        | no       | Extra attributes tried **before** `href` when reading or writing page URLs                                                       |

### `pageIndexDecoration`

Controls the decoration target for each `pageIndexes` match. Page number and URL still resolve on the matched node.

| Field                    | What you set                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `useImmediateParent`     | Use the match’s immediate parent as the decoration target (**wins over** `closestSelectors`)          |
| `closestSelectors`       | `string[]` for `element.closest` (first matching selector) as the decoration target under the root    |
| `loadedPageClassNames`   | Non-empty `string[]` of CSS classes added when that additional page finishes loading (`done`)         |

When `pageIndexDecoration` is omitted, or closest/parent cannot be resolved inside the pager root, status and classes apply on the `pageIndexes` match itself.

After a successful run (every tracked page `done`), the module writes previous/next pointer URLs onto the pager controls. While pages load, decoration targets get `data-sm-ap-status` and, on `done`, any `loadedPageClassNames`.

## Context manager: `url`

Use when the current page number comes only from the tab URL (no pager DOM to bind).

| Field         | Required | What you set                                                    |
| ------------- | -------- | --------------------------------------------------------------- |
| `type`        | yes      | `"url"`                                                         |
| `urlTemplate` | yes      | Pattern with `{{NUMBER}}`, a query-param value source whose `key` is the page parameter, or a `pathSuffix` (see [URL templates](#url-templates)) |

Pair with `"incremental"` or `"decremental"`. There is no DOM pager update.

## URL templates

Numbered strategies build each fetch URL from a template that contains `{{NUMBER}}`, from a query-param value source, or from a path suffix. `"next-link"` ignores `urlTemplate` when composing URLs (it follows the next control).

`urlTemplate` is a **string** or an **object**. An object must define **exactly one** of `template`, `source`, or `pathSuffix`.

In the browser editor, choose **URL template kind** `Static template` (string / `{ template }`), `Value source` (same Value Source controls as Content Manager), or `Path suffix`, plus **Copy page query params**.

| Form          | Example                                                            | Notes                                                                                                                                          |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| String        | `"/page/{{NUMBER}}"`                                               | Same as `{ template: " ...", copyPageQueryParams: true }`                                                                                      |
| Static object | `{ template: "/page/{{NUMBER}}/", copyPageQueryParams?: boolean }` | `template` must include `{{NUMBER}}` and be a path starting with `/` or an absolute `http://` / `https://` URL                                 |
| Source object | `{ source: ValueSource, copyPageQueryParams?: boolean }`           | A `query-param` source uses `key` as the page parameter. Any other source resolves against the live document/tab to a string with `{{NUMBER}}` |
| Path suffix   | `{ pathSuffix: "/page/{{NUMBER}}", copyPageQueryParams?: boolean }` | Appends the suffix to the tab pathname after removing one trailing match of that suffix                                                       |

| Field                 | Default | What it does                                                                              |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `copyPageQueryParams` | `true`  | When context resolves, copies the current tab’s query string onto every numbered page URL |

Resolution runs once when the module builds pagination context. When the template contains `{{NUMBER}}`, numbered strategies substitute it and then merge the snapshotted query. When the source is `query-param`, they keep the tab pathname, merge the snapshotted query, and set `key` to the page being fetched. A `pathSuffix` resolves to a `{{NUMBER}}` template from the tab pathname before that substitution.

**Page query parameter (`page`):**

```ts
urlTemplate: {
  source: {
    source: "query-param",
    key: "page",
  },
}
```

On `/list?q=cats&page=2`, the next page URL is `/list?q=cats&page=3`. The pathname stays `/list`. Copied params such as `q` stay, and `page` is the fetched page number. When `page` is absent, the current page number is the strategy fallback (`1`, or `0` when numbering starts at zero).

**Path suffix (`/page/{{NUMBER}}`):**

```ts
urlTemplate: {
  pathSuffix: "/page/{{NUMBER}}",
  copyPageQueryParams: true,
}
```

| Pathname          | Resolved template          | Page read |
| ----------------- | -------------------------- | --------- |
| `/`               | `/page/{{NUMBER}}`         | fallback  |
| `/catalog/`       | `/catalog/page/{{NUMBER}}` | fallback  |
| `/catalog/page/2` | `/catalog/page/{{NUMBER}}` | `2`       |

On `/catalog/page/2?q=cats`, the next page URL is `/catalog/page/3?q=cats`. The suffix is trailing: `/catalog/page/2/extra` keeps that path and appends the suffix.

A pager link contributes its page number when the link pathname ends with `pathSuffix`. Relative hrefs resolve against the current tab URL before that match.

**Keep search params (common on search result pages):**

```ts
urlTemplate: {
  source: {
    source: "path",
    map: [{
      type: "replace",
      regexes: ["(/pagina/)\\d+"],
      replacement: "$1{{NUMBER}}",
    }],
  },
  // copyPageQueryParams defaults to true → preserves ?s= ... and similar
}
```

Value source details: [Value source](../utils/value-source.md).

## Paging strategies

| `type`          | Behavior                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `"next-link"`   | Reads the next URL from paginator `next` controls; returns at most one next page per step; requires `dom` + `nextSelectors` |
| `"incremental"` | Builds URLs with page numbers increasing from the current page via `urlTemplate`                                            |
| `"decremental"` | Same as incremental with next/previous numbering swapped                                                                    |

With a DOM context manager, incremental and decremental strategies fetch further pages only when page-index numbers resolve a last page, unless `ignoreLastPage` is `true`. A URL context manager has no pager, so those strategies still build the configured page count from the URL template.

Numbered strategy fields (`"incremental"` / `"decremental"`):

| Field                          | Default       | What you set                                           |
| ------------------------------ | ------------- | ------------------------------------------------------ |
| `numberingStartsFromZero`      | `false`       | When `true`, numbers in built URLs start at `0`        |
| `numberingLabelStartsFromZero` | same as above | When `true`, progress UI labels use zero-based numbers |

## How a load run works

On `CONTENT_LOADED` (live tab document only), a load run:

1. Reads `SuperMonkey.loadedIntegration?.contentManager`. When Content Manager is missing, the module skips fetching.
2. Keeps binder keys whose Content Manager listing matches the document (`hasListingContext`, including the listing `pageFilter`) and whose binder `pageFilter` passes the active mapped-page names. See [Page filter](#page-filter).
3. Processes all matching group binders sequentially in `groups` key order. A group whose **Pages to Load (`groupKey`)** preference is `0` skips the counted fetch. When **Load Until Visible Item** is on, that group still requests further pages while the latest Content Manager listing scan kept no items.
4. For each enabled group, resolves its pagination context, validates its strategy, and fetches each additional page. After each fetch it republishes `CONTENT_LOADED` with the fetched `Document` so Content Manager runs a full scan and remaining cards append into the live listing containers. With **Load Until Visible Item** on, each fetched page asks `hasListingItems()` after that scan. Kept items in any group stop every remaining binder. The extra fetch also stops when the strategy has no next page.

Handlers ignore `CONTENT_LOADED` when `document` is not the live tab document (so a republished foreign document does not start another load run).

When **every** tracked page is `done`, it applies paginator pointers (DOM manager only). Any `pending`, `progress`, or `error` page leaves pointers unchanged.

**Retry** (progress menu) reloads only a failed page. When retries leave every page loaded, pointers apply.

## Progress UI

The module adds a [progress menu](./notification-bar.md#progress-menu) on the Notification Bar. Failed pages show **Retry**. The menu host is `progress` while work runs, then `error` or `done` when nothing remains in `progress`.

For an incremental or decremental group, the menu subtitle reads `Page: {current} of {total}` once that group's last page number is known. Labels follow `numberingLabelStartsFromZero`. Several numbered groups in one run prefix each summary with its group key. A next-link group leaves the subtitle unset.

The icon stays off the bar while every group's **Pages to Load** preference is `0` and **Load Until Visible Item** is off. Raising any group above `0`, or turning that preference on, shows the icon again.

## Runtime configurations

Shown in the Configuration Menu (end-user preferences, not integration opts):

| Configuration                                    | Scope     | Default | Min    | Max      | Description                                          |
| ------------------------------------------------ | --------- | ------- | ------ | -------- | ---------------------------------------------------- |
| **Pages to Load (`groupKey`)**                   | per group | `0`     | `0`    | `99`     | How many pages that group fetches (`0` skips the counted fetch) |
| **Load Until Visible Item** (`loadUntilVisible`) | global    | off     |        |          | Keeps fetching the next page until Content Manager keeps items for any group |
| **Page Load Interval (ms)** (`pageLoadInterval`) | global    | `1000`  | `100`  | `10000`  | Delay between page requests                          |
| **Page Load Timeout (ms)** (`pageLoadTimeout`)   | global    | `10000` | `1000` | `180000` | Per-request timeout                                  |

Each per-group preference displays the Content Manager group key in its label. The interval and timeout apply to every group binder.

## Normalization

`normalizeAdditionalPagesOpts(raw)` returns [`Normalized<AdditionalPagesOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/additional-pages/additional-pages-opts.ts`).

| Outcome    | When                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reject** | Raw opts are not an object; `groups` is missing or not an object; or no usable group binder remains.                                                                                                                                               |
| **Repair** | Empty group keys and unusable binders are dropped; malformed optional fields are dropped (`ignoreLastPage`, optional selectors, `pageFilter`, `pageRequestOpts`, optional `urlTemplate` on `dom`). A binder is unusable when its required context manager / strategy pair, selectors, or numbered URL template cannot be normalized. |

The loader constructs `AdditionalPages` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Name every `groups` key after the exact [Content Manager group](./content-manager.md#groups) it extends.
- Set a binder `pageFilter` when that group should load extra pages only on some mapped pages. The listing `pageFilter` still has to match as well.
- Wire that group's [Content Manager listings](./content-manager.md#listings) to match both the live page and the HTML of fetched pages.
- Choose [paging shape](#pick-a-paging-shape) from how the site actually paginates (next link vs numbered URL).
- For numbered URLs that keep filters/search in the query string, prefer `copyPageQueryParams` (default) or a `source` template built from the live path.
- For a page number in a trailing path suffix, set `pathSuffix` to that suffix, such as `/page/{{NUMBER}}`.
- For a page query parameter, set `urlTemplate.source` to `{ source: "query-param", key: "<param>" }`. Fetched URLs keep the tab pathname and write the page number to that key after any copied query params.
- Set `ignoreLastPage: true` when visible page indexes are incomplete or misleading, or when the pager is absent and numbered strategies should still fetch the configured page count.
- Use `pageIndexDecoration` when status/classes should sit on an ancestor of the page-index match (for example match `a` and decorate `li`), including `loadedPageClassNames` for the site’s loaded-page look.
- Leave each group's **Pages to Load (`groupKey`)** preference for the user; default `0` means that group does not load additional pages.

## Full example

Numbered paging with a DOM pager, static template, and loaded-page classes:

```ts
import { Integration } from "../metadata";

export const MYSITE_COM_INTEGRATION: Integration = {
  name: "mysite_com",
  matchedDomains: ["mysite.com"],
  contentManager: {
    groups: {
      items: {
        listings: [
          {
            name: "catalog",
            containerSelectors: [".item-list"],
            entriesSelectors: [".item"],
            entryIdSource: [{ source: "attribute", attributes: ["data-id"] }],
          },
        ],
      },
    },
  },
  modules: {
    additionalPages: {
      module: "AdditionalPages",
      opts: {
        groups: {
          items: {
            contextManager: {
              type: "dom",
              urlTemplate: "/list?page={{NUMBER}}",
              paginatorSelectors: {
                rootContainers: [".pager"],
                previousSelectors: [".pager-prev"],
                nextSelectors: [".pager-next"],
                currentSelectors: [".pager-current"],
                pageIndexes: [".pager-page a"],
                pageIndexDecoration: {
                  closestSelectors: [".pager-page"],
                  loadedPageClassNames: ["is-loaded"],
                },
              },
            },
            pagingStrategy: { type: "incremental" },
          },
        },
      },
    },
  },
};
```

## Runtime types

For module authors extending or debugging the loaders: `ContextManagerLoader` / `PagingStrategyLoader` build `ContextManager` and `PagingStrategy` from the normalized opts. Shared state is `PaginationContext` (`rootPage`, `cursor`, `paginators`, optional `resolvedUrlTemplate`). Sources under `src/supermonkey/modules/additional-pages/context-manager/`, `.../paging-strategy/`, `.../url-template.ts`, and `.../metadata.ts`.

## See also

- [Content Manager](./content-manager.md)
- [Value source](../utils/value-source.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Integration DSL](../integrations/dsl.md)
- [TypeScript integration](../integrations/README.md)
- [Modules overview](./README.md)
- [Notification Bar](./notification-bar.md)
- [Configuration](./configuration.md)
