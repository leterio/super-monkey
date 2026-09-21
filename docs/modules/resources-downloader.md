# Resources Downloader

Resources Downloader (`module: "ResourcesDownloader"`) maps downloadable media inside Content Manager entries to a download control, optional nesting (collections), and optional multi-step download pipelines.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `ResourcesDownloader` and fill the typed **Mappings** (and optional **Download modes**) fields. URL extraction: [Value source](../utils/value-source.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page          | Reference                                                             |
| --------------------- | --------------------------------------------------------------------- |
| Editor options        | [Options shape](#options-shape)                                       |
| Editor walkthrough    | [In the editor (Pattern A)](#in-the-editor-pattern-a)                 |
| TypeScript wiring     | [TypeScript wiring](#typescript-wiring)                               |
| Prerequisites         | [Before you enable it](#before-you-enable-it)                         |
| Choosing shape        | [Pick a mapping shape](#pick-a-mapping-shape)                         |
| Full opts             | [What you configure](#what-you-configure)                             |
| Single resource       | [Leaf mapping](#leaf-mapping)                                         |
| Nested resources      | [Collection mapping](#collection-mapping)                             |
| Button placement      | [Decoration](#decoration)                                             |
| Multi-step fetches    | [Download modes](#download-modes)                                     |
| Defaults              | [Built-in mappings](#built-in-mappings)                               |
| Content Manager hooks | [How it reacts to Content Manager](#how-it-reacts-to-content-manager) |
| User-facing knobs     | [Runtime configurations](#runtime-configurations)                     |
| Opts walk             | [Normalization](#normalization)                                       |

## Options shape

Stored and TypeScript integrations use this opts object (`module: "ResourcesDownloader"`). The browser editor exposes **Mappings** and optional **Download modes** as typed fields (selector lists use CSV; mapping children and wrap class lists use one value per line; URL sources may be attribute names or Value Source controls).

**Pattern A - One custom leaf on cards:**

```json
{
  "mappings": {
    "postImage": {
      "type": "leaf",
      "selectors": ["img.preview"],
      "urlSources": ["src", "data-src"]
    }
  }
}
```

**Pattern B - Collection wrapping built-in leaves:**

```json
{
  "mappings": {
    "post": {
      "type": "collection",
      "selectors": ["article.post"],
      "children": ["images"]
    }
  }
}
```

Full field tables: [What you configure](#what-you-configure). Built-in keys: [Built-in mappings](#built-in-mappings).

## In the editor (Pattern A)

1. Confirm Content Manager listings/views publish entry roots on the page ([Content Manager - In the editor](./content-manager.md#in-the-editor)).
2. In **Modules**, add an instance with **Module key** `ResourcesDownloader`.
3. Under **Mappings**, add a leaf with **Key** `postImage`, **Selectors** `img.preview`, and **URL sources** attribute names `src` then `data-src` (or match Pattern B from [Options shape](#options-shape)).
4. For an intermediate page before the file URL, add a **Download mode** with a **Document** step: set **Selectors** on the Value Source to match elements inside the fetched HTML, then keep a final **Download** step. Point the leaf’s **Download mode** at that mode name.
5. Save, reload, and confirm download controls appear on matched cards (Notification Bar may show download progress).
6. If **Save** fails validation, fix the opts fields - `validateIntegration` runs Resources Downloader opts normalization at Save time ([editor validation](../integrations/editor-ui.md#validation)).
7. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md).

## TypeScript wiring

Register the constructor key `ResourcesDownloader` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "ResourcesDownloader"` and the opts below. Source: `src/supermonkey/modules/resources-downloader/`.

**Pattern A - One custom leaf on cards:**

```ts
modules: {
  resourcesDownloader: {
    module: "ResourcesDownloader",
    opts: {
      mappings: {
        postImage: {
          type: "leaf",
          selectors: ["img.preview"],
          urlSources: ["src", "data-src"],
        },
      },
    },
  },
},
```

**Pattern B - Collection wrapping built-in leaves:**

```ts
modules: {
  resourcesDownloader: {
    module: "ResourcesDownloader",
    opts: {
      mappings: {
        post: {
          type: "collection",
          selectors: ["article.post"],
          children: ["images"],
        },
      },
    },
  },
},
```

Here `post` is the entry point. Built-in `images` runs only under each matched `article.post`.

**Pattern C - Leaf with ValueSource URL:**

```ts
modules: {
  resourcesDownloader: {
    module: "ResourcesDownloader",
    opts: {
      mappings: {
        video: {
          type: "leaf",
          selectors: ["player[packaged-media-json]"],
          urlSources: [{
            source: "attribute",
            attributes: ["packaged-media-json"],
            map: [
              { type: "json_path", path: "playbackMp4s.permutations" },
              { type: "pick", at: "first" },
              { type: "json_path", path: "source.url" },
            ],
          }],
          decoration: {
            closestSelectors: ["[slot='media']"],
            overridePosition: true,
          },
        },
      },
    },
  },
},
```

Use Pattern C when the URL lives in a non-trivial attribute (JSON, href with query id, srcset pick).

## Before you enable it

Resources Downloader scans **inside Content Manager entry elements**. Pair it with a usable `contentManager` that has listings and/or views so `entities-injected` / `entity-viewed` supply roots to map. See [Content Manager](./content-manager.md).

Without those events (or when they never fire), the module can still load but stays idle (progress icon only).

`ModuleLoader` runs `normalizeResourcesDownloaderOpts` before construction. When no usable **user** entry-point mapping remains, opts **reject** (no instance). Individual bad mappings or download modes are dropped (**repair**); the module loads with the cleaned set.

Normalized `mappings` keep **only user keys** (built-ins are not stored). At runtime the module consolidates built-ins under `images` / `videos` / `audios` (your key wins on collision). Only **your** mapping keys that are **not** referenced as another mapping’s `children` become **entry points**. Entry-point scan order runs **collections before leaves**, so nested resources are claimed by collections first. Built-in keys may be used as **children**; they are not entry points by themselves. A user key that is identical to a built-in is dropped as a repair (use a different key for a top-level scan with the same shape).

## Pick a mapping shape

| Site shape                                | Mapping                                                 | Typical children / sources                    |
| ----------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| One downloadable node per hit             | `type: "leaf"`                                          | `urlSources` on that node                     |
| Container with several media nodes        | `type: "collection"`                                    | `children` keys (your leaves and/or builtins) |
| Standard `img` / `video` / `audio` markup | Prefer builtins as children or override the builtin key | See [Built-in mappings](#built-in-mappings)   |
| Direct file URL on the element            | Default mode `"download"`                               | -                                             |
| Must open an intermediate page first      | Custom [download mode](#download-modes) on the leaf     | Document steps + final `download`             |

## What you configure

Top-level opts (`ResourcesDownloaderOpts`):

| Field           | Required | What you set                                                                                                  |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `mappings`      | yes      | Record of mapping key → leaf or collection (at least one usable **user** mapping that becomes an entry point) |
| `downloadModes` | no       | Extra named multi-step modes (`"download"` is always available)                                               |

How many downloads run at once is a **user** preference - see [Runtime configurations](#runtime-configurations).

## Leaf mapping

Matches elements that each represent **one** downloadable resource.

| Field              | Required | What you set                                                                                                                                                                      |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | yes      | `"leaf"`                                                                                                                                                                          |
| `selectors`        | yes      | Non-empty `string[]` - elements that hold the resource                                                                                                                            |
| `urlSources`       | yes      | Ordered list of attribute **names** (`string`) and/or [`ValueSource`](../utils/value-source.md) objects. At download time, the first non-empty value on the **live** element wins |
| `downloadMode`     | no       | Mode name (defaults to `"download"`)                                                                                                                                              |
| `ignoreDecoration` | no       | When `true`, skip the download button for this mapping                                                                                                                            |
| `decoration`       | no       | Where/how to attach the button - see [Decoration](#decoration)                                                                                                                    |

## Collection mapping

Matches a **container**, then scans nested mapping keys inside it.

| Field              | Required | What you set                                                                 |
| ------------------ | -------- | ---------------------------------------------------------------------------- |
| `type`             | yes      | `"collection"`                                                               |
| `selectors`        | yes      | Non-empty `string[]` - container elements                                    |
| `children`         | yes      | Mapping keys to scan inside each container (must exist; cycles are rejected) |
| `ignoreDecoration` | no       | When `true`, skip decoration on the collection itself                        |
| `decoration`       | no       | See [Decoration](#decoration)                                                |

A collection with a **single** child leaf is flattened to that leaf for the resource tree (the leaf keeps the child’s `mappedBy` and has no `parent`). The collection element still receives `data-sm-rd-mapped-by` with the **collection** key. Empty collections are omitted. Nested collections remain children of the parent collection.

## Decoration

Controls where the download button attaches relative to the matched element.

| Field                    | What you set                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `wrapElement`            | Wrap the target in a container before attaching the button                                       |
| `wrapClasses`            | Extra wrap classes (`string[]`); applied before copied or built-in wrap classes                  |
| `wrapCopyElementClasses` | Copy the target’s classes onto the wrap                                                          |
| `useImmediateParent`     | Use the target’s immediate parent as the decoration container (**wins over** `closestSelectors`) |
| `closestSelectors`       | `string[]` for `element.closest` (first matching selector) as the decoration target              |
| `overridePosition`       | Set `position: relative` on the decoration container                                             |

Style hooks for Custom CSS: `[data-sm-rd-mapped-by="…"]`, `[data-sm-rd-decorated-by="…"]`, `[data-sm-rd-state="…"]` - see [Custom CSS - Stable styling hooks](./custom-css.md#stable-styling-hooks).

## Download modes

Named pipelines in `downloadModes`. Leaf `downloadMode` selects which pipeline runs (default `"download"`).

| Field   | What you set                                                |
| ------- | ----------------------------------------------------------- |
| `name`  | Unique mode id (**must not** collide with `"download"`)     |
| `steps` | Non-empty list of document steps, ending in a download step |

**Document step** - `{ mode: "document", valueSource, method?, headers?, data?, timeout? }`

- Fetches an intermediate page (`GM_xmlhttpRequest`), parses HTML, resolves `valueSource` against that document.
- `valueSource` must be an **element** source (`attribute`, `text`, or `srcset`) with at least one `selectors` entry. `query-param` and `path` are rejected for document steps.
- Relative URLs resolve against the fetched document’s final URL.
- Step `data` fields that are ValueSource objects resolve against the **live leaf** element before the request.

**Download step** - `{ mode: "download", headers?, timeout? }`

- Must be the **last** step. If the last step is not `download`, normalization appends `{ mode: "download" }`. A `download` step anywhere else drops the mode.

| Mode         | Behavior                                                                            |
| ------------ | ----------------------------------------------------------------------------------- |
| `"download"` | Saves the URL resolved from the leaf’s `urlSources` with Tampermonkey `GM_download` |
| Custom name  | Runs that mode’s `steps` (document steps, then the final download)                  |

## Built-in mappings

Always available at runtime under these keys unless you override the same key with a **different** mapping:

| Key      | Role                                                                                                                   | Default decoration                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `images` | `img` elements that expose known src/srcset attributes (including lazy/`data-*`); srcset/`data-*` sources before `src` | `wrapElement` + `overridePosition`                 |
| `videos` | `video > source[src]` (typed sources first)                                                                            | `closestSelectors: ["video"]` + `overridePosition` |
| `audios` | `audio > source[src]` (typed sources first)                                                                            | `closestSelectors: ["audio"]` + `overridePosition` |

A user mapping with the same key and a **different** shape **replaces** the built-in. A user mapping identical to the built-in is dropped (repair). Built-ins are not entry points; reference them from a collection’s `children`, or copy their shape into your own entry-point leaf (different key) if you need a top-level scan.

## How it reacts to Content Manager

| Hook / event         | When Resources Downloader runs                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `onEntitiesInjected` | After listing inject for Content Manager entries: scan each entry element for entry-point mappings                  |
| `onEntityViewed`     | When a view entity is viewed: scan the entity element (falls back to `document.body` when missing)                  |
| `onBeforeUnload`     | When any mapped resource is downloading: calls `notifyPendingOperations()` so the browser can prompt before leaving |

Resources Downloader does not override `onIntegrationLoaded` or `onContentLoaded`. Unload prompt behavior: [Script Lifecycle - BEFORE_UNLOAD](../supermonkey/lifecycle.md#before_unload).

### How a scan run works

1. Take the entry’s managed element as the scan root (views without an element fall back to `document.body`).
2. Match **entry-point** mappings in order (collections first, then leaves).
3. Build a tree of leaves and collections; decorate new roots with a download control when decoration is enabled.
4. Mark mapping targets with `data-sm-rd-mapped-by` (value = mapping key) so later scans skip them. Each mapped element also gets `data-sm-rd-state` with the resource’s item state. Decoration containers get `data-sm-rd-decorated-by` when a button is attached; a container that already has the attribute is not decorated again.

DOM markers:

| Attribute                 | Values / meaning                                       |
| ------------------------- | ------------------------------------------------------ |
| `data-sm-rd-mapped-by`    | Mapping key that claimed the element                   |
| `data-sm-rd-decorated-by` | Mapping key that attached a download control           |
| `data-sm-rd-state`        | Resource item state (`pending`, `progress`, `done`, …) |

Content Manager event names and payloads: [Content Manager - Events](./content-manager.md#events).

### How a download runs

A download starts from a decoration button, **Download All**, or **Retry**.

For each **leaf**, admission resolves the first non-empty `urlSources` value on the live element as the download URL and progress-menu row label, creates or updates that menu row, sets the leaf to `progress` (progress `0`), sets `attempt` to `1` on a fresh run, then enqueues the leaf for network execution. An empty URL result logs an error, sets the leaf (and its button) to error, and does not enqueue or auto-retry. The session queue only orders network execution under `parallelDownloads`; admission does not wait for an execution slot.

A **collection** admits every descendant leaf that is not already in progress, after dropping leaves whose resolved URL already appeared earlier in that batch (those leaves become `skipped`). Every admitted leaf appears in the progress menu as `progress` immediately, including leaves still waiting for execution capacity.

Custom modes: when a document step resolves **multiple** URLs, every branch continues in parallel through the remaining steps; each final URL becomes a separate saved file. Progress rows track branches (first URL on the initial row; additional URLs get their own rows). Any branch failure marks the leaf as error; retry restarts the full pipeline.

Saved file names come from the last path segment of the final URL, with a `"download"` fallback.

### Progress UI, cancel, and retry

While a leaf is in progress (admitted and waiting in the execution queue, or actively downloading), hovering a progress-menu row shows **Cancel**. On error, **Cancel** and **Retry** appear. Cancel on a waiting queued row removes that leaf from the session execution queue without starting network work. Cancel also clears any pending auto-retry timer. Cancel (or **Cancel All**) on an in-flight leaf aborts document fetches and `GM_download` calls, skips remaining steps, removes menu rows for the leaf, and sets `cancelled`.

After a non-abort network/pipeline failure, if the leaf’s `attempt` is less than or equal to `downloadRetries`, the leaf stays `error` and an auto-retry is scheduled after `downloadRetryIntervalMs`. When the timer fires, `attempt` increments by one, the leaf is re-admitted (menu + `progress`), and it is pushed to the **end** of the session execution queue. The delay does not occupy an execution-queue slot or a network permit. With `downloadRetries` at `0`, the first failure never auto-requeues. Unresolved leaf URLs never auto-retry.

Manual **Retry** / **Retry All** clear any queue membership and pending auto-retry timer, reset `attempt` to `1`, and re-admit (they ignore the `downloadRetries` ceiling for that fresh run).

Status on the **resource element** uses `data-sm-rd-state` (`pending`, `progress`, `done`, `error`, `skipped`, `cancelled`), including while `pending`. Status on the **download button** uses `data-state` (`progress`, `done`, `error`, `skipped`, `cancelled`); that attribute is omitted while `pending`. Parent collections aggregate child status (progress → error → pending → done; `skipped` counts like done; `cancelled` like pending). The menu lists every admitted leaf with a resolved URL (including those waiting for execution). Collections do not appear as menu rows.

The [progress menu](./notification-bar.md) also offers **Download All**, **Retry All**, and **Cancel All**. Download All admits every leaf that is pending, cancelled, or failed, after URL dedupe in walk order, and skips leaves already in the execution queue, executing, or waiting on an auto-retry timer. Leaves already `skipped` are not restarted by Download All; a manual click on a skipped leaf still runs. Retry All re-admits failed leaves with `attempt` reset to `1`. Cancel All cancels every leaf that is waiting in the execution queue, waiting on an auto-retry timer, or actively downloading.

## Runtime configurations

Shown in the Configuration Menu (end-user preference):

| Control                        | Key                        | Default | Role                                                                                                                                                                                                 |
| ------------------------------ | -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enable resources mapping       | `enableResourcesMapping`   | `true`  | When `false` at module boot, mapping, decoration, Progress Menu, and the other runtime controls stay inactive for that page load. The toggle remains available so the user can turn mapping back on; a page refresh applies the new value |
| Parallel downloads             | `parallelDownloads`        | `10`    | Session-wide maximum concurrent network operations (document fetches and final downloads), clamped to 1–50. Shared across all starts, Download All, Retry All, collection runs, and branch fan-out within a leaf |
| Download retries               | `downloadRetries`          | `0`     | Automatic retries after a failed download (`0` disables auto-retry; max `10`). After failure, if `attempt <= downloadRetries`, the leaf is re-queued after the retry interval                                      |
| Download retry interval (ms)   | `downloadRetryIntervalMs`  | `1000`  | Fixed delay before an automatic retry is queued, clamped to 1000–30000 ms                                                                                                                            |

Notification Bar: a `ProgressMenuEntry` exposes download progress plus **Download All** / **Retry All** / **Cancel All**.

## Normalization

`normalizeResourcesDownloaderOpts(raw)` returns [`Normalized<ResourcesDownloaderOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/resources-downloader/resources-downloader-opts.ts`).

| Outcome    | When                                                                                                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object; `mappings` missing/empty; no usable user mappings remain; no scannable **user entry points** (builtins alone are not enough).                                                                                                                         |
| **Repair** | Bad mappings or download modes dropped; empty selectors / urlSources / children fixed or dropped; unknown `downloadMode` drops the leaf; cycles and dangling collection children removed; user keys identical to a built-in mapping removed; mid-pipeline `download` steps drop the mode; missing final `download` step is appended. |

The loader constructs `ResourcesDownloader` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Tips

- Wire Content Manager listings/views that expose the DOM nodes you will map.
- Prefer a **collection** entry point when several media nodes belong to one card; use builtins as `children` when markup is standard.
- Order `urlSources` from most specific to fallback (`srcset` / `data-*` before plain `src` when both exist).
- Place the button with `decoration` (`closestSelectors` / `useImmediateParent` / wrap) so it sits on a positioned container.
- Use a custom download mode only when the file URL is not on the leaf element.
- Keep mapping keys stable; they appear in `data-sm-rd-*` attributes and Custom CSS hooks.
- Confirm normalization left at least one **user** entry-point mapping (builtins alone are not enough).

## Full example

Collection entry point with custom leaves and builtin-style decoration:

```ts
import { DEFAULT_IMG_URL_SOURCES } from "../../utils/links";
import { Integration } from "../metadata";

export const MYSITE_COM_INTEGRATION: Integration = {
  name: "mysite_com",
  matchedDomains: ["mysite.com"],
  contentManager: {
    groups: {
      posts: {
        listings: [
          {
            name: "feed",
            containerSelectors: ["#feed"],
            entriesSelectors: ["article"],
            entryIdSource: [{ source: "attribute", attributes: ["id"] }],
          },
        ],
      },
    },
  },
  modules: {
    resourcesDownloader: {
      module: "ResourcesDownloader",
      opts: {
        mappings: {
          postImage: {
            type: "leaf",
            selectors: ["img.preview"],
            urlSources: DEFAULT_IMG_URL_SOURCES,
            decoration: { useImmediateParent: true },
          },
          post: {
            type: "collection",
            selectors: ["article"],
            children: ["postImage", "videos"],
            decoration: {
              closestSelectors: ["article"],
              overridePosition: true,
            },
          },
        },
      },
    },
  },
};
```

Here `post` is the only entry point (`postImage` is only a child). Built-in `videos` is scanned under each `article`.

## See also

- [Value source](../utils/value-source.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Content Manager](./content-manager.md)
- [Custom CSS](./custom-css.md)
- [Notification Bar](./notification-bar.md)
- [Configuration](./configuration.md)
- [Integration DSL](../integrations/dsl.md)
- [TypeScript integration](../integrations/README.md)
- [Modules overview](./README.md)
