# Content Manager

> **Browser path:** configure groups, views, listings, and optional **Page filter** in the [Integration editor](../integrations/editor-ui.md#content-manager) → **Save** → reload → inspect `data-sm-cm-*` markers. You do not need TypeScript for this path.

Content Manager maps the live page into **groups**, resolves stable ids, and publishes parse / inject / view events so feature modules can react. Modules do not call Content Manager directly.

**Maintainers / module authors** (contracts below the editor path):

- [Loader ownership](#contributors)
- [Events](#events)
- [Listing context (`hasListingContext`)](#listing-context-helper)
- [Normalization](#normalization)

## contentManager (JSON)

Paste into Import / Share JSON as the top-level `contentManager` object, or fill the same fields in the editor panel ([panel labels](#panel-labels--json-keys)).

**Minimum - one listing (attribute id):**

```json
{
  "scanMode": "onload",
  "groups": {
    "posts": {
      "listings": [
        {
          "name": "feed",
          "containerSelectors": [".feed"],
          "entriesSelectors": [".post[data-post-id]"],
          "entryIdSource": [
            {
              "source": "attribute",
              "attributes": ["data-post-id"]
            }
          ]
        }
      ]
    }
  }
}
```

**Atlas-style - mapped pages + page filters + interval scan:**

```json
{
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
}
```

Pair `pageFilter` values with [Mapped pages](../integrations/editor-ui.md#mapped-pages) (editor) or [Mapped pages (TypeScript)](../integrations/README.md#mapped-pages-typescript) on the same integration. Full Atlas file: [Tutorial - Final stored JSON](../integrations/tutorial.md#final-stored-json).

**Id from href** (listing reads id on a child link, manages an ancestor card): see [Matching the id vs managing the card](#matching-the-id-vs-managing-the-card) and [Integration editor - Id from href](../integrations/editor-ui.md#id-from-href).

## Quick reference

| Concept     | Purpose                                                    | Details                     |
| ----------- | ---------------------------------------------------------- | --------------------------- |
| Group       | Names one content kind shared by views and listings.       | [Groups](#groups)           |
| View        | Resolves one open item's id from the URL or a DOM element. | [Views](#views)             |
| Listing     | Resolves ids for many items inside page containers.        | [Listings](#listings)       |
| Scan        | Controls page-load and interval discovery.                 | [Scan mode](#scan-mode)     |
| Page filter | Gates each view/listing against active mapped pages.       | [Page filter](#page-filter) |

## In the editor

1. Choose **Scan mode** and, for interval scanning, set **Scan interval (ms)**.
2. Add a group and enter the **Group name** that modules use for this content kind.
3. Add each open-item mapping under **Views**. Enter its required **Name**, optional **Page filter**, optional **Selectors**, and ID **Source**.
4. Add each multi-item mapping under **Listings**. Enter its required **Name**, optional **Page filter**, container selectors, entry selectors, and **Entry ID sources**.
5. Save the integration, reload the page, and inspect the managed elements for `data-sm-cm-*` attributes.

The [integration editor](../integrations/editor-ui.md) explains the create and save flow. The [value source reference](../utils/value-source.md) describes source fields and map steps.

### Panel labels ↔ JSON keys

| Editor label                      | JSON key / shape                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| **Scan mode**                     | `scanMode` (`onload` or `interval`)                                                       |
| **Scan interval (ms)**            | `scanIntervalMs`                                                                          |
| **Group name**                    | Object key under `groups`                                                                 |
| View or listing **Name**          | Required `name`                                                                           |
| **Page filter**                   | Optional `pageFilter` (CSV of mapped page names; `!!` exclusions)                         |
| **Selectors**                     | View `selectors`                                                                          |
| **Container selectors**           | `containerSelectors`                                                                      |
| **Entry selectors**               | `entriesSelectors`                                                                        |
| **Entry container selectors**     | `entryContainerSelector`                                                                  |
| **Cleanup**                       | `cleanup` (`removeNonEntities` or `removeSelectors`)                                      |
| **Cleanup remove selectors**      | `cleanup.removeSelectors`                                                                 |
| **Entry ID sources** / **Source** | Listing `entryIdSource` / view `idSource`; **Source** selects the value source's `source` |

## Editor field reference

Each group needs at least one usable view or listing. A site can define both for the same group when the content appears on detail pages and in cards or rows.

### Groups

`contentManager.groups` is a map of group key → `{ views?, listings? }`. A group is one content kind (for example `videos` or `posts`). At least one of `views` or `listings` should be present.

| Field      | What you set                                                              |
| ---------- | ------------------------------------------------------------------------- |
| `views`    | Optional array of open-item mappings. Each usable view resolves one id.   |
| `listings` | Optional array of multi-item mappings. Each scan discovers cards or rows. |

Reuse a group key everywhere that content kind needs to correlate with modules and events.

### Views

A view detects an open item and resolves one id.

| Field        | What you set                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `name`       | Required stable name for this view configuration and downstream filters.                                                  |
| `pageFilter` | Optional mapped-page names that gate this view. Empty/omitted runs on every page. See [Page filter](#page-filter).        |
| `selectors`  | Optional CSS selectors for the base element when `idSource` reads from the DOM. Omit for a source that reads the tab URL. |
| `idSource`   | Required [value source](../utils/value-source.md) for the content id.                                                     |

Selector views mark the matched element with `data-sm-cm-viewed` (space-separated group keys) and remember `group::id` so the same id is not published again.

Each newly resolved view publishes `entity-viewed` (`EntityViewedEventPayload`) once.

```json
{
  "views": [
    {
      "name": "watch",
      "idSource": { "source": "query-param", "key": "v" }
    },
    {
      "name": "embedded-player",
      "selectors": ["video[data-video-id]"],
      "idSource": { "source": "attribute", "attributes": ["data-video-id"] }
    }
  ]
}
```

### Listings

A listing finds many items under containers.

| Field                    | What you set                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `name`                   | Required stable name for this listing configuration and downstream filters.                                           |
| `pageFilter`             | Optional mapped-page names that gate this listing. Empty/omitted runs on every page. See [Page filter](#page-filter). |
| `containerSelectors`     | Required listing roots to search. Every qualifying container is processed.                                            |
| `entriesSelectors`       | Required nodes to select inside each container. Every qualifying node is processed.                                   |
| `entryIdSource`          | Required [value sources](../utils/value-source.md) tried in order on the selected node; the first non-empty id wins.  |
| `entryContainerSelector` | Optional closest selectors for the managed element when the selected node is a deep child.                            |
| `cleanup`                | Optional post-discover cleanup. Choose `{ "removeNonEntities": true }` or `{ "removeSelectors": ["..."] }`.           |

### Page filter

Each view and listing may set `pageFilter` against the integration's [mapped pages](../integrations/editor-ui.md#mapped-pages) ([TypeScript](../integrations/README.md#mapped-pages-typescript)). At the start of every Content Manager scan batch, Super Monkey resolves which mapped-page names match the current pathname, then skips any view or listing that fails the filter.

| Filter shape                      | Behavior                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| Omitted / `[]`                    | Runs on every page                                                |
| Allowlist (`["home", "feed"]`)    | Runs only when at least one named page is active                  |
| Denylist (`["!!settings"]`)       | Runs on every page except when a negated name is active           |
| Hybrid (`["feed", "!!feed_ads"]`) | Requires an allowlisted active page and none of the negated names |

Spell mapped-page names exactly as defined under **Mapped pages**. A typo in `pageFilter` never matches, so an allowlist with an unknown name skips the view or listing on every URL.

```json
{
  "name": "feed",
  "pageFilter": ["home", "!!settings"],
  "containerSelectors": [".feed"],
  "entriesSelectors": [".post"],
  "entryIdSource": [{ "source": "attribute", "attributes": ["data-post-id"] }]
}
```

`hasListingContext(document, groupKey?)` uses the same filter so modules do not treat filtered-out listings as present. An omitted `groupKey` checks every listing group; a provided key checks only that group (unknown keys return `false`).

New entries receive `data-sm-cm-listed` (group keys) and `data-sm-cm-<groupKey>-id` (resolved id). Already-listed nodes are skipped.

#### Listing cleanup

`removeNonEntities` removes a direct child of the listing container when the child is not a listed entity for the group and does not contain one.

```json
{
  "listings": [
    {
      "name": "feed",
      "containerSelectors": [".feed"],
      "entriesSelectors": [".post"],
      "entryIdSource": [{ "source": "attribute", "attributes": ["data-post-id"] }],
      "cleanup": { "removeNonEntities": true }
    }
  ]
}
```

`removeSelectors` removes selected nodes inside the container unless a selected node is exactly the listed entity element. Use precise selectors because selecting an ancestor or descendant can remove entity content.

```json
{
  "listings": [
    {
      "name": "feed",
      "containerSelectors": [".feed"],
      "entriesSelectors": [".post"],
      "entryIdSource": [{ "source": "attribute", "attributes": ["data-post-id"] }],
      "cleanup": { "removeSelectors": [".ad-slot", ".promo"] }
    }
  ]
}
```

The cleanup modes are mutually exclusive. Normalization drops an empty or unusable cleanup object.

#### Matching the id vs managing the card

When `entriesSelectors` selects a deep node that contains the id, set `entryContainerSelector` to manage its closest card ancestor. The search remains inside the listing container.

```json
{
  "listings": [
    {
      "name": "catalog",
      "containerSelectors": [".catalog"],
      "entriesSelectors": [".card a"],
      "entryIdSource": [{ "source": "attribute", "attributes": ["href"] }],
      "entryContainerSelector": [".card"]
    }
  ]
}
```

When the selected node is the managed entry, omit `entryContainerSelector`.

#### Listing pipeline

1. Discover new entities.
2. Publish `entities-parsed` (`Map` of group → `ListedEntity[]`). Handlers may set `hide: true`.
3. Apply: remove hidden nodes. When the scanned document is the tab document, remaining nodes stay in place. When it is a different document, remaining entities are appended to the first matching listing container on the tab document. If that container is missing, those entities are omitted from `entities-injected`.
4. Publish `entities-injected` with the entities that remain.

### Scan mode

| Field            | Role                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `scanMode`       | `"onload"` (default) or `"interval"`.                                                                |
| `scanIntervalMs` | Interval in milliseconds when `scanMode` is `"interval"`. Default `1000`; clamped to `1000`–`60000`. |

`onload` scans on each `CONTENT_LOADED` (including republished foreign documents). `interval` also starts a timer that rescans **selector** views and listings on the tab document (URL-only views are skipped on the interval pass).

A discover pass that takes more than 100 ms logs a warning with the duration.

## Contributors

Loader ownership, Events, and listing context:

`ContentManagerLoader.load(opts)` constructs at most one instance per tab. Omit `integration.contentManager` to skip load (`null`, no FATAL). A second `load` logs an error and returns. [Normalization](#normalization) runs before construct. A rejected walk or a thrown error logs FATAL and leaves Content Manager off.

The instance extends `Component`. It **owns** `CONTENT_LOADED`: on `INTEGRATION_LOADED` it publishes `CONTENT_LOADED` with the live tab document. On each `CONTENT_LOADED` it scans **views** then **listings** on `event.data.document` (live or foreign), then starts interval rescans once when configured. Without Content Manager, `CONTENT_LOADED` is never published.

Source: `src/supermonkey/content-manager/`.

### Events

| Event               | When                                                      | Payload        |
| ------------------- | --------------------------------------------------------- | -------------- |
| `entity-viewed`     | Each newly resolved view                                  | `{ entity }`   |
| `entities-parsed`   | After listing discover, before hidden nodes are removed   | `{ entities }` |
| `entities-injected` | After hidden nodes are removed, remaining listed entities | `{ entities }` |

`Module` registers handlers for these names at construction (`onEntityViewed`, `onEntitiesParsed`, `onEntitiesInjected`).

#### Listing context helper

When a module needs to know whether a listing container exists in a document, it reads `SuperMonkey.loadedIntegration?.contentManager` and calls `hasListingContext(document)` or `hasListingContext(document, groupKey)` to scope the check to one content group. To run another full content scan on a document, republish `CONTENT_LOADED` with that `document` (Content Manager owns the event and performs the scan).

Pipeline events stay on `EventBus`. Modules do not hold a Content Manager reference from construction.

## Normalization

`normalizeContentManagerOpts(raw)` returns [`Normalized<ContentManagerOpts>`](../utils/opts-normalization.md) (`src/supermonkey/content-manager/content-manager-opts.ts`). `validateContentManagerOpts` returns the same findings without the value.

| Outcome    | When                                                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object, or no usable group remains.                                                                                                                                       |
| **Repair** | Unknown `scanMode` (falls back to `onload`); `scanIntervalMs` out of range or ignored on `onload`; empty/invalid groups, views, listings, selectors, names, `pageFilter`, or cleanup dropped. |

A group needs at least one usable view or listing after the walk. View `idSource` and listing `entryIdSource` go through [value-source normalization](../utils/opts-normalization.md#value-sources). Listing cleanup must be exactly `removeNonEntities: true` or a non-empty `removeSelectors` list.

The loader constructs `ContentManager` with the cleaned `value`. Repair findings log as WARN (`Content manager options were repaired:`).

## Authoring checklist

- Choose stable group keys for content kinds, such as `videos`, `posts`, or `comments`.
- Give every view and listing a required, stable `name`.
- Use `pageFilter` when a view or listing should run only on specific [mapped pages](../integrations/editor-ui.md#mapped-pages) ([TypeScript](../integrations/README.md#mapped-pages-typescript)).
- Put one-open-item mappings in `views` and multi-item surfaces in `listings`.
- Use URL value sources for view ids in the tab URL and DOM value sources when a selected element carries the id.
- Set `entryContainerSelector` when a listing reads the id from a child but manages the ancestor card.
- Use a value source `map` when the raw URL, attribute, or text contains more than the id.
- Choose `interval` scanning for content added after load and set `scanIntervalMs` from `1000` through `60000`.
- Confirm that selected listing nodes resolve non-empty ids and receive Content Manager attributes.

## See also

- [Integration editor](../integrations/editor-ui.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Value source](../utils/value-source.md)
- [Authoring a module](./authoring.md)
- [Additional Pages](./additional-pages.md)
- [TypeScript integration](../integrations/README.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
- [Runtime signals](../integrations/runtime-signals.md)
