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

Stored and TypeScript integrations use this opts object (`module: "AdditionalPages"`). The browser editor exposes the same fields as typed controls (selector lists, URL attributes, and loaded page class names use CSV). Each group binder keeps the Content Manager group name and the context/paging type selects visible; detail fields live in foldable **Context manager**, **Paging strategy** (numbered strategies only), and **Page request** sections that start collapsed.

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

Each key under `groups` is the exact name of a Content Manager group. A binder runs only when that group's listing matches the current document, including its listing `pageFilter`.

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

The `items` and `offers` keys match Content Manager group names. On each mapped page, listing `pageFilter` values determine which group binders are eligible to run. How many pages to load is a per-group **user** preference in the Configuration Menu - see [Runtime configurations](#runtime-configurations). Full field tables: [What you configure](#what-you-configure).

## In the editor (Pattern A)

1. Confirm Content Manager already has a **listing** for each group you want to extend ([Content Manager - In the editor](./content-manager.md#in-the-editor)).
2. In **Modules**, add an instance with **Module key** `AdditionalPages`.
3. Under **Groups**, add a group binder and set **Content Manager group name** to the exact group key, such as `items`.
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
| `pageRequestOpts` | no       | Optional HTTP overrides for this group's requests (`method`, `headers`)         |

How many pages to load and delays are **user** preferences in the Configuration Menu - see [Runtime configurations](#runtime-configurations). They are not integration opts.

## Context manager: `dom`

Use when the page shows a pager you can select in the DOM.

| Field                | Required | What you set                                                                                                                        |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`               | yes      | `"dom"`                                                                                                                             |
| `paginatorSelectors` | yes      | Selector map for pager roots and controls (table below)                                                                             |
| `urlTemplate`        | no\*     | Pattern with `{{NUMBER}}` for numbered strategies and for reading page numbers from links / the tab URL                             |
| `ignoreLastPage`     | no       | When `true`, leaves `totalPages` unset even if page-index links are visible (use when the pager does not expose the real last page) |

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
| `urlTemplate` | yes      | Must include `{{NUMBER}}` (see [URL templates](#url-templates)) |

Pair with `"incremental"` or `"decremental"`. There is no DOM pager update.

## URL templates

Numbered strategies build each fetch URL from a template that still contains `{{NUMBER}}`. `"next-link"` ignores `urlTemplate` when composing URLs (it follows the next control).

`urlTemplate` is a **string** or an **object**. An object must define **exactly one** of `template` or `source`.

In the browser editor, choose **URL template kind** `Static template` (string / `{ template }`) or `Value source` (same Value Source controls as Content Manager), plus **Copy page query params**.

| Form          | Example                                                            | Notes                                                                                                          |
| ------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| String        | `"/page/{{NUMBER}}"`                                               | Same as `{ template: " ...", copyPageQueryParams: true }`                                                      |
| Static object | `{ template: "/page/{{NUMBER}}/", copyPageQueryParams?: boolean }` | `template` must include `{{NUMBER}}` and be a path starting with `/` or an absolute `http://` / `https://` URL |
| Source object | `{ source: ValueSource, copyPageQueryParams?: boolean }`           | Resolves against the live document/tab; the string result must include `{{NUMBER}}`                            |

| Field                 | Default | What it does                                                                              |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `copyPageQueryParams` | `true`  | When context resolves, copies the current tab’s query string onto every numbered page URL |

Resolution runs once when the module builds pagination context. Numbered strategies substitute `{{NUMBER}}`, then merge that snapshotted query.

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

Numbered strategy fields (`"incremental"` / `"decremental"`):

| Field                          | Default       | What you set                                           |
| ------------------------------ | ------------- | ------------------------------------------------------ |
| `numberingStartsFromZero`      | `false`       | When `true`, numbers in built URLs start at `0`        |
| `numberingLabelStartsFromZero` | same as above | When `true`, progress UI labels use zero-based numbers |

## How a load run works

On `CONTENT_LOADED` (live tab document only), a load run:

1. Reads `SuperMonkey.loadedIntegration?.contentManager`. When Content Manager is missing, the module skips fetching.
2. Checks every binder key with `hasListingContext(document, groupKey)`. This includes the group's listing `pageFilter`, so only groups with an active listing context match.
3. Processes all matching group binders sequentially in `groups` key order. A group whose **Pages to Load (`groupKey`)** preference is `0` skips fetching.
4. For each enabled group, resolves its pagination context, validates its strategy, and fetches each additional page. After each fetch it republishes `CONTENT_LOADED` with the fetched `Document` so Content Manager runs a full scan and remaining cards append into the live listing containers.

Handlers ignore `CONTENT_LOADED` when `document` is not the live tab document (so a republished foreign document does not start another load run).

When **every** tracked page is `done`, it applies paginator pointers (DOM manager only). Any `pending`, `progress`, or `error` page leaves pointers unchanged.

**Retry** (progress menu) reloads only a failed page. When retries leave every page loaded, pointers apply.

## Progress UI

The module adds a [progress menu](./notification-bar.md#progress-menu) on the Notification Bar. Failed pages show **Retry**. The menu host is `progress` while work runs, then `error` or `done` when nothing remains in `progress`.

## Runtime configurations

Shown in the Configuration Menu (end-user preferences, not integration opts):

| Configuration                                    | Scope     | Default | Min    | Max      | Description                                          |
| ------------------------------------------------ | --------- | ------- | ------ | -------- | ---------------------------------------------------- |
| **Pages to Load (`groupKey`)**                   | per group | `0`     | `0`    | `99`     | How many pages that group fetches (`0` skips it)     |
| **Page Load Interval (ms)** (`pageLoadInterval`) | global    | `1000`  | `100`  | `10000`  | Delay between page requests                          |
| **Page Load Timeout (ms)** (`pageLoadTimeout`)   | global    | `10000` | `1000` | `180000` | Per-request timeout                                  |

Each per-group preference displays the Content Manager group key in its label. The interval and timeout apply to every group binder.

## Normalization

`normalizeAdditionalPagesOpts(raw)` returns [`Normalized<AdditionalPagesOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/additional-pages/additional-pages-opts.ts`).

| Outcome    | When                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reject** | Raw opts are not an object; `groups` is missing or not an object; top-level `contextManager` / `pagingStrategy` fields are present; or no usable group binder remains.                                                                                                                                               |
| **Repair** | Empty group keys and unusable binders are dropped; malformed optional fields are dropped (`ignoreLastPage`, optional selectors, `pageRequestOpts`, optional `urlTemplate` on `dom`). A binder is unusable when its required context manager / strategy pair, selectors, or numbered URL template cannot be normalized. |

The loader constructs `AdditionalPages` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Name every `groups` key after the exact [Content Manager group](./content-manager.md#groups) it extends.
- Wire that group's [Content Manager listings](./content-manager.md#listings) to match both the live page and the HTML of fetched pages.
- Choose [paging shape](#pick-a-paging-shape) from how the site actually paginates (next link vs numbered URL).
- For numbered URLs that keep filters/search in the query string, prefer `copyPageQueryParams` (default) or a `source` template built from the live path.
- Set `ignoreLastPage: true` when visible page indexes are incomplete or misleading.
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
