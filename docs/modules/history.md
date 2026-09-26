# History

History (`module: "History"`) tracks listed and viewed content ids for a Content Manager group, marks entry elements with history state, and exposes hide, decoration, and backup controls in the Configuration Menu.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `History` and fill the typed opts fields (required: **Group**). Events and group keys: [Content Manager](./content-manager.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page          | Reference                                                                       |
| --------------------- | ------------------------------------------------------------------------------- |
| Editor options        | [Options shape](#options-shape)                                                 |
| Editor walkthrough    | [In the editor (Pattern A)](#in-the-editor-pattern-a)                           |
| TypeScript wiring     | [TypeScript wiring](#typescript-wiring)                                         |
| Prerequisites         | [Before you enable it](#before-you-enable-it)                                   |
| Minimum viable        | [Minimum viable setup](#minimum-viable-setup)                                   |
| Full opts             | [What you configure](#what-you-configure)                                       |
| Name filters          | [Name filters](#name-filters)                                                   |
| Decoration styles     | [Decoration styles](#decoration-styles)                                         |
| Content Manager hooks | [How History reacts to Content Manager](#how-history-reacts-to-content-manager) |
| User-facing knobs     | [Runtime configurations](#runtime-configurations)                               |
| Opts walk             | [Normalization](#normalization)                                                 |

## Options shape

Stored and TypeScript integrations use this opts object (`module: "History"`). The browser editor exposes the same fields as typed inputs (`newContentSelectors`, `recordFilter`, and `decorateFilter` are CSV). Required: `group`.

**Minimum** - record one Content Manager group:

```json
{
  "group": "posts"
}
```

**With decoration styles:**

```json
{
  "group": "posts",
  "viewedStyles": "& { border: 2px solid red !important; }",
  "listedStyles": "& { border: 2px solid yellow !important; }"
}
```

**Exclude a listing name from recording** (Content Manager listings need matching `name` values):

```json
{
  "group": "posts",
  "recordFilter": ["!!related"],
  "viewedStyles": "& { border: 2px solid red !important; }",
  "listedStyles": "& { border: 2px solid yellow !important; }"
}
```

Full field table: [What you configure](#what-you-configure).

## In the editor (Pattern A)

1. Confirm Content Manager already defines the **group** you will track ([Content Manager - In the editor](./content-manager.md#in-the-editor)).
2. In **Modules**, add an instance named `history_books` with **Module key** `History`.
3. Set **Group** to `books` (or `posts` from the [Options shape](#options-shape) examples). Optionally fill new content selectors, record/decorate filters, and viewed/listed styles.
4. Save, reload, open a listing or item page, and confirm `data-sm-history` markers in Elements when history applies.
5. If **Save** fails validation, fix the opts fields - `validateIntegration` runs History opts normalization at Save time; a missing or blank **Group** is rejected and blocks Save ([editor validation](../integrations/editor-ui.md#validation)).
6. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md) - unknown module key, rejected opts at load, or constructor failure skips that instance.

## Minimum viable setup

### Pattern A - Record and decorate one group

Use the [Options shape](#options-shape) examples above in the editor, or the TypeScript wiring below for built-ins. **In the editor (Pattern A)** and **Options shape** describe the same stored `opts` object — the UI uses CSV fields where TypeScript uses `string[]`.

Records every matching listing/view id in the group, marks DOM with `data-sm-history`, and injects decoration CSS when the matching **Decorate Viewed Content** / **Decorate Listed Content** preference is on.

## TypeScript wiring

Register the constructor key `History` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "History"` and the opts below. Source: `src/supermonkey/modules/history/`.

**Minimum - one group, record related listings out of history:**

```ts
modules: {
  history: {
    module: "History",
    opts: {
      group: "posts",
      recordFilter: ["!!related"],
    },
  },
},
```

**With decoration styles and new content selectors:**

```ts
modules: {
  history: {
    module: "History",
    opts: {
      group: "posts",
      newContentSelectors: [".badge-new", "[data-updated='true']"],
      recordFilter: ["!!related"],
      viewedStyles: "& { border: 2px solid red !important; }",
      listedStyles: "& { border: 2px solid yellow !important; }",
    },
  },
},
```

Hide viewed/listed content is a **user** preference in the Configuration Menu - see [Runtime configurations](#runtime-configurations).

## Before you enable it

History depends on Content Manager:

- The active integration defines a usable `contentManager` with a group whose key matches `opts.group`.
- Listing entries need resolvable ids (`entryIdSource`) and DOM elements so History can mark and hide them.
- View detection publishes `entity-viewed` so opened items move into viewed history.

Configure [Content Manager listings and views](./content-manager.md) first. Each listing/view needs a `name` before using `recordFilter` / `decorateFilter`.

`group` is **required**. `ModuleLoader` runs `normalizeHistoryOpts` before construction. Missing or blank `group` **reject** (no instance).

History reacts on `onEntitiesParsed` and `onEntityViewed` (Content Manager events). It does not override `onIntegrationLoaded` or `onContentLoaded`.

## What you configure

Top-level opts (`HistoryOpts`):

| Field                 | Required | What you set                                                                                                         |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `group`               | yes      | Content Manager group key this instance tracks                                                                       |
| `newContentSelectors` | no       | Selectors for markers of new subcontent on an entry (`data-sm-has-new-content="true"`)                               |
| `recordFilter`        | no       | Allow/deny list against the view/listing `name` - controls whether History **writes** ids into listed/viewed history |
| `decorateFilter`      | no       | Allow/deny list against `name` - controls history DOM attributes, new-content markers, and hide                      |
| `viewedStyles`        | no       | CSS rules with `&` as `[data-sm-history="viewed"]`                                                                   |
| `listedStyles`        | no       | CSS rules with `&` as `[data-sm-history="listed"]`                                                                   |

## Name filters

`recordFilter` and `decorateFilter` use the same allow/deny name-list protocol as domain matching ([Integration DSL](../integrations/dsl.md)). They match Content Manager **`name`** on the listing or view config that produced the entry:

| Filter shape                          | Effect                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| Omitted, empty, or only blank entries | Allowed for every entry                                       |
| Positives (`"feed"`)                  | Entry `name` must match at least one filter name              |
| Negatives (`"!!related"`)             | Entry `name` must not match any excluded name                 |
| Negatives only                        | Allowed for every entry whose `name` is not in the exclusions |

The two filters are **independent**. Example: `recordFilter: ["!!related"]` stops related cards from entering listed history, while decoration/hide can still apply from existing history when `decorateFilter` allows.

## Decoration styles

Pass CSS rules that use `&` as the history-state selector. History replaces each `&` with `[data-sm-history="viewed"]` or `[data-sm-history="listed"]` when injecting. Every comma-separated selector in every top-level rule must include `&` after normalization.

```ts
viewedStyles: "& { border: 2px solid red !important; background: rgba(255,0,0,0.05); }",
listedStyles: "& { border: 2px solid yellow !important; }",
```

Descendant or compound selectors:

```ts
viewedStyles: "& shreddit-post, & .card { border-left: 0.15em solid red; }",
listedStyles: "&.book-card { outline: 2px solid yellow; }",
```

Normalization keeps the trimmed source with `&`. Selectors missing `&` are repaired by prefixing `& ` (for example `&, foo` becomes `&, & foo`). Strings without usable top-level rules are dropped.

When `viewedStyles` is non-empty, History exposes **Decorate Viewed Content** and injects the expanded viewed CSS. When `listedStyles` is non-empty, it exposes **Decorate Listed Content** and injects the expanded listed CSS. Each toggle is independent (no extra wrapper).

For styles unrelated to History markers, use [Custom CSS](./custom-css.md).

## How History reacts to Content Manager

| Hook / event       | When History runs                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onEntitiesParsed` | After listing discover for `opts.group`: set `data-sm-history` when `decorateFilter` allows; set `data-sm-has-new-content` when new content selectors match; may set `hide = true` when hide options are on; add unread ids to listed history when `recordFilter` allows |
| `onEntityViewed`   | When `entity.group` matches `opts.group` and `recordFilter` allows, mark the id as viewed                                                                                                                                                                                |

Priority when marking a listing entry: **viewed → listed → unread**. On first sight the attribute is `unread` (if decorating) and the id is added to listed history (if recording); later parses for that id use `listed`.

New ids sit in a short-lived session set and flush into stored history arrays with a short debounce. Remote storage changes from other tabs re-flush any pending session ids.

DOM markers:

| Attribute                 | Values / meaning                             |
| ------------------------- | -------------------------------------------- |
| `data-sm-history`         | `viewed`, `listed`, or `unread`              |
| `data-sm-has-new-content` | `"true"` when a new content selector matched |

Content Manager event names and payloads: [Content Manager - Events](./content-manager.md#events).

## Runtime configurations

Shown in the Configuration Menu (end-user preferences and actions):

| Control                              | Key                         | Default | Role                                                                                                                              |
| ------------------------------------ | --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Decorate Viewed Content              | `decorateViewedContent`     | `true`  | Inject decoration CSS from `viewedStyles` (only when set)                                                                         |
| Decorate Listed Content              | `decorateListedContent`     | `true`  | Inject decoration CSS from `listedStyles` (only when set)                                                                         |
| Hide Viewed Content                  | `hideViewedContent`         | `false` | Hide viewed entries (`display: none` and/or remove via `hide`)                                                                    |
| Hide Listed Content                  | `hideListedContent`         | `false` | Hide listed entries the same way                                                                                                  |
| Keep new content visible when hiding | `showEntriesWithNewContent` | `true`  | Keep entries marked with `data-sm-has-new-content` visible even when hide options are on (only when `newContentSelectors` is set) |
| Clear History                        | `clearHistory` (`Action`)   | -       | Wipe listed and viewed stored ids (after confirm)                                                                                 |
| Backup History                       | `backupHistory` (`Action`)  | -       | Download JSON `{ listed, viewed }` (flushes session ids first)                                                                    |
| Restore History                      | `restoreHistory` (`Action`) | -       | Merge ids from a JSON backup (or a plain newline list as listed-only)                                                             |

Listed and viewed ids persist under module storage keys `listedHistory` and `viewedHistory` (`ArrayConfiguration`). Those arrays are not shown as editable lists in the menu; Clear / Backup / Restore manage them.

Turning a hide option off leaves already-removed entries out of the DOM until the page reloads.

## Normalization

`normalizeHistoryOpts(raw)` returns [`Normalized<HistoryOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/history/history-opts.ts`).

| Outcome    | When                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object; `group` missing or blank after trim.                                                                                                                          |
| **Repair** | Bad `newContentSelectors`, `recordFilter`, or `decorateFilter` entries dropped; non-string or unusable `viewedStyles` / `listedStyles` dropped; selectors missing `&` prefixed with `& `. |

The loader constructs `History` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Point `group` at the Content Manager group whose ids you care about.
- Set listing/view `name` values before using `recordFilter` / `decorateFilter`.
- Prefer History `viewedStyles` / `listedStyles` (with `&`) for history decoration; use [Custom CSS](./custom-css.md) for unrelated page styles.
- Use `newContentSelectors` when updated cards should stay visible under user hide settings.
- After Clear/Restore, rely on a fresh parse or navigation to refresh the DOM.

## Full example

One group with feed + related listings, record filter, and decoration:

```ts
import { Integration } from "../metadata";

export const MYSITE_COM_INTEGRATION: Integration = {
  name: "mysite_com",
  matchedDomains: ["mysite.com"],
  contentManager: {
    groups: {
      posts: {
        views: [
          {
            name: "open",
            idSource: { source: "attribute", attributes: ["id"] },
            selectors: ["#content-main > [id^='post-']"],
          },
        ],
        listings: [
          {
            name: "feed",
            containerSelectors: [".item-list"],
            entriesSelectors: [".item"],
            entryIdSource: [{ source: "attribute", attributes: ["data-id"] }],
          },
          {
            name: "related",
            containerSelectors: [".related"],
            entriesSelectors: [".item"],
            entryIdSource: [{ source: "attribute", attributes: ["data-id"] }],
          },
        ],
      },
    },
  },
  modules: {
    history: {
      module: "History",
      opts: {
        group: "posts",
        recordFilter: ["!!related"],
        viewedStyles: "& { border: 2px solid red !important; }",
        listedStyles: "& { border: 2px solid yellow !important; }",
      },
    },
  },
};
```

## See also

- [Custom CSS](./custom-css.md)
- [Content Manager](./content-manager.md)
- [Configuration](./configuration.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Integration DSL](../integrations/dsl.md)
- [TypeScript integration](../integrations/README.md)
- [Modules overview](./README.md)
