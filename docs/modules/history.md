# History

History (`module: "History"`) tracks listed and viewed content ids for one or more Content Manager groups, marks entry elements with history state, and exposes hide, decoration, and backup controls in the Configuration Menu.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `History` and add at least one group binder (required: **Content Manager group**). Events and group keys: [Content Manager](./content-manager.md). Site matching: [Integration DSL](../integrations/dsl.md).

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

Stored and TypeScript integrations use this opts object (`module: "History"`). Each key under `groups` is the exact Content Manager group name. The browser editor exposes the same binder fields as typed inputs (`newContentSelectors`, `recordFilter`, and `decorateFilter` are CSV). Required: at least one group.

**Minimum** - record one Content Manager group:

```json
{
  "groups": {
    "posts": {}
  }
}
```

**With decoration styles:**

```json
{
  "groups": {
    "posts": {
      "viewedStyles": "& { border: 2px solid red !important; }",
      "listedStyles": "& { border: 2px solid yellow !important; }"
    }
  }
}
```

**Two groups, with one listing name left out of recording:**

```json
{
  "groups": {
    "posts": {
      "recordFilter": ["!!related"],
      "viewedStyles": "& { border: 2px solid red !important; }",
      "listedStyles": "& { border: 2px solid yellow !important; }"
    },
    "comments": {}
  }
}
```

Full field table: [What you configure](#what-you-configure).

## In the editor (Pattern A)

1. Confirm Content Manager already defines each **group** you will track ([Content Manager - In the editor](./content-manager.md#in-the-editor)).
2. In **Modules**, add an instance named `history_books` with **Module key** `History`.
3. Under **Groups**, set **Content Manager group** to `books` (or `posts` from the [Options shape](#options-shape) examples). Optionally fill new content selectors, record/decorate filters, and viewed/listed styles. Use **Add group** for another Content Manager group.
4. Save, reload, open a listing or item page, and confirm `data-sm-history` markers in Elements when history applies.
5. If **Save** fails validation, fix the opts fields - `validateIntegration` runs History opts normalization at Save time; a blank group name, a duplicate group name, or no usable group is rejected and blocks Save ([editor validation](../integrations/editor-ui.md#validation)).
6. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md) - unknown module key, rejected opts at load, or constructor failure skips that instance.

## Minimum viable setup

### Pattern A - Record and decorate one or more groups

Use the [Options shape](#options-shape) examples above in the editor, or the TypeScript wiring below for built-ins. **In the editor (Pattern A)** and **Options shape** describe the same stored `opts` object — the UI uses CSV fields where TypeScript uses `string[]`.

Records every matching listing/view id in each configured group, marks DOM with `data-sm-history` and `data-sm-history-group`, and injects that group's decoration CSS when its **Decorate Viewed Content** / **Decorate Listed Content** preference is on.

## TypeScript wiring

Register the constructor key `History` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "History"` and the opts below. Source: `src/supermonkey/modules/history/`.

**Minimum - one group, record related listings out of history:**

```ts
modules: {
  history: {
    module: "History",
    opts: {
      groups: {
        posts: {
          recordFilter: ["!!related"],
        },
      },
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
      groups: {
        posts: {
          newContentSelectors: [".badge-new", "[data-updated='true']"],
          recordFilter: ["!!related"],
          viewedStyles: "& { border: 2px solid red !important; }",
          listedStyles: "& { border: 2px solid yellow !important; }",
        },
      },
    },
  },
},
```

Hide viewed/listed content is a **user** preference in the Configuration Menu, one pair of toggles per group - see [Runtime configurations](#runtime-configurations).

## Before you enable it

History depends on Content Manager:

- The active integration defines a usable `contentManager` with a group for each key under `opts.groups`.
- Listing entries need resolvable ids (`entryIdSource`) and DOM elements so History can mark and hide them.
- View detection publishes `entity-viewed` so opened items move into viewed history.

Configure [Content Manager listings and views](./content-manager.md) first. Each listing/view needs a `name` before using `recordFilter` / `decorateFilter`.

`groups` is **required** and must contain at least one usable binder. `ModuleLoader` runs `normalizeHistoryOpts` before construction. A missing `groups` object or no usable binder **rejects** (no instance).

History reacts on `onEntitiesParsed` and `onEntityViewed` (Content Manager events). It does not override `onIntegrationLoaded` or `onContentLoaded`.

## What you configure

Top-level opts (`HistoryOpts`):

| Field    | Required | What you set                                                                                          |
| -------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `groups` | yes      | Map of exact Content Manager group key to one group binder (see below)                               |

Each value under `groups` is a binder (`HistoryGroupOpts`). An empty binder `{}` records and marks that group with no extra selectors, filters, or styles.

| Field                 | Required | What you set                                                                                                         |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `newContentSelectors` | no       | Selectors for markers of new subcontent on an entry (`data-sm-has-new-content="true"`)                               |
| `recordFilter`        | no       | Allow/deny list against the view/listing `name` - controls whether History **writes** ids into that group's history |
| `decorateFilter`      | no       | Allow/deny list against `name` - controls history DOM attributes, new-content markers, and hide                      |
| `viewedStyles`        | no       | CSS rules with `&` as that group's viewed selector (`[data-sm-history="viewed"][data-sm-history-group="…"]`)         |
| `listedStyles`        | no       | CSS rules with `&` as that group's listed selector (`[data-sm-history="listed"][data-sm-history-group="…"]`)         |

## Name filters

`recordFilter` and `decorateFilter` use the same allow/deny name-list protocol as domain matching ([Integration DSL](../integrations/dsl.md)). They match Content Manager **`name`** on the listing or view config that produced the entry. Each group binder has its own filters.

| Filter shape                          | Effect                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| Omitted, empty, or only blank entries | Allowed for every entry in that group                         |
| Positives (`"feed"`)                  | Entry `name` must match at least one filter name              |
| Negatives (`"!!related"`)             | Entry `name` must not match any excluded name                 |
| Negatives only                        | Allowed for every entry whose `name` is not in the exclusions |

The two filters are **independent**. Example: `recordFilter: ["!!related"]` stops related cards from entering listed history, while decoration/hide can still apply from existing history when `decorateFilter` allows.

## Decoration styles

Pass CSS rules that use `&` as the history-state selector. For a binder under `groups.posts`, History replaces each `&` in `viewedStyles` with `[data-sm-history="viewed"][data-sm-history-group="posts"]`, and each `&` in `listedStyles` with `[data-sm-history="listed"][data-sm-history-group="posts"]`. The group attribute value is that binder's Content Manager group key. Every comma-separated selector in every top-level rule must include `&` after normalization.

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

A binder with non-empty `viewedStyles` exposes **Decorate Viewed Content** for that group and injects only that binder's expanded viewed CSS. A binder with non-empty `listedStyles` exposes **Decorate Listed Content** for that group the same way. Each toggle is its own stylesheet.

For styles unrelated to History markers, use [Custom CSS](./custom-css.md).

## How History reacts to Content Manager

| Hook / event       | When History runs                                                                                                                                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onEntitiesParsed` | For each payload group that has a binder: set `data-sm-history` and `data-sm-history-group` when that binder's `decorateFilter` allows; set `data-sm-has-new-content` when that binder's new content selectors match; may set `hide = true` when that group's hide options are on; add unread ids to that group's listed history when `recordFilter` allows |
| `onEntityViewed`   | When `entity.group` has a binder and that binder's `recordFilter` allows, mark the id as viewed in that group's store                                                                                                                                                                                     |

Priority when marking a listing entry: **viewed → listed → unread**. On first sight the attribute is `unread` (if decorating) and the id is added to that group's listed history (if recording); later parses for that id use `listed`.

New ids sit in a short-lived session set and flush into that group's stored history arrays with a short debounce. Remote storage changes from other tabs re-flush any pending session ids. Groups do not share a flush debounce.

DOM markers:

| Attribute                 | Values / meaning                                      |
| ------------------------- | ----------------------------------------------------- |
| `data-sm-history`         | `viewed`, `listed`, or `unread`                       |
| `data-sm-history-group`   | Content Manager group key that owns the marker        |
| `data-sm-has-new-content` | `"true"` when a new content selector matched          |

Content Manager event names and payloads: [Content Manager - Events](./content-manager.md#events).

## Runtime configurations

Shown in the Configuration Menu (end-user preferences and actions). Hide and decorate are one set per configured group. **Keep new content visible when hiding**, Clear, Backup, and Restore are one set for the instance.

For each group, in `groups` key order, the menu lists **Decorate Viewed Content** (when that binder has `viewedStyles`), **Decorate Listed Content** (when that binder has `listedStyles`), **Hide Viewed Content**, and **Hide Listed Content**. The shared keep-new control follows those rows. Clear, Backup, and Restore follow that.

With one group, hide and decorate labels omit the group key. With more than one group, each of those labels includes it (`Hide Viewed Content — posts`).

| Control                              | Key                                          | Default | Role                                                                                                                                       |
| ------------------------------------ | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Decorate Viewed Content              | `decorateViewedContent::<safeGroupId>`       | `true`  | Inject that group's `viewedStyles` (only when that binder sets them)                                                                       |
| Decorate Listed Content              | `decorateListedContent::<safeGroupId>`       | `true`  | Inject that group's `listedStyles` (only when that binder sets them)                                                                       |
| Hide Viewed Content                  | `hideViewedContent::<safeGroupId>`           | `false` | Hide viewed entries in that group (`display: none` and/or remove via `hide`)                                                              |
| Hide Listed Content                  | `hideListedContent::<safeGroupId>`           | `false` | Hide listed entries in that group the same way                                                                                             |
| Keep new content visible when hiding | `showEntriesWithNewContent`                  | `true`  | Keep entries marked with `data-sm-has-new-content` visible even when a group's hide options are on (only when some binder sets `newContentSelectors`) |
| Clear History                        | `clearHistory` (`Action`)                    | -       | Wipe listed and viewed stored ids for every configured group (after confirm)                                                              |
| Backup History                       | `backupHistory` (`Action`)                   | -       | Download JSON `{ groups: { [groupKey]: { listed, viewed } } }` (flushes session ids first)                                                 |
| Restore History                      | `restoreHistory` (`Action`)                  | -       | Merge ids from a JSON backup into configured groups with the same key                                                                     |

Listed and viewed ids persist per group under `listedHistory::<safeGroupId>` and `viewedHistory::<safeGroupId>` (`ArrayConfiguration`). `safeGroupId` is the group key when it is a valid id segment (`[A-Za-z0-9_-]+`); otherwise it is the hex code points of the key joined by `_`. Those arrays are not shown as editable lists in the menu; Clear / Backup / Restore manage them.

Backup JSON:

```json
{
  "groups": {
    "posts": { "listed": [], "viewed": [] }
  }
}
```

Restore merges ids into configured groups with the same key. Keys in the file that are not configured are ignored. Configured groups missing from the file are left unchanged.

Turning a hide option off leaves already-removed entries out of the DOM until the page reloads.

## Normalization

`normalizeHistoryOpts(raw)` returns [`Normalized<HistoryOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/history/history-opts.ts`).

| Outcome    | When                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object; `groups` is missing or not an object; or no usable group binder remains.                                                                                                      |
| **Repair** | Blank or duplicate group keys skipped; non-object binders skipped; bad `newContentSelectors`, `recordFilter`, or `decorateFilter` entries dropped; non-string or unusable styles dropped; selectors missing `&` prefixed with `& `. |

The loader constructs `History` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Name every `groups` key after the exact [Content Manager group](./content-manager.md#groups) it tracks.
- Set listing/view `name` values before using `recordFilter` / `decorateFilter`.
- Prefer History `viewedStyles` / `listedStyles` (with `&`) for history decoration; use [Custom CSS](./custom-css.md) for unrelated page styles.
- Use `newContentSelectors` when updated cards should stay visible under user hide settings.
- After Clear/Restore, rely on a fresh parse or navigation to refresh the DOM.

## Full example

One instance with two groups. Posts skip the related listing; comments use an empty binder:

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
      comments: {
        listings: [
          {
            name: "thread",
            containerSelectors: [".comments"],
            entriesSelectors: [".comment"],
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
        groups: {
          posts: {
            recordFilter: ["!!related"],
            viewedStyles: "& { border: 2px solid red !important; }",
            listedStyles: "& { border: 2px solid yellow !important; }",
          },
          comments: {},
        },
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
