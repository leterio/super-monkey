# Page filter

Editor authors: set **Page filter** on Content Manager views and listings in the [Integration editor](../integrations/editor-ui.md#content-manager) — see [Content Manager - Page filter](../modules/content-manager.md#page-filter). History name filters use view/listing **names**, not mapped-page names — [History - Name filters](../modules/history.md#name-filters).

This page is the shared allow/deny rule reference (`passesPageFilter` and the `!!` prefix from [Integration DSL](../integrations/dsl.md)).

## Rules

| Filter shape | Result |
| ------------ | ------ |
| Omitted, `null`, `[]`, or only blank strings | Allowed (filter ignored) |
| Positives only (for example `["feed", "detail"]`) | Allowed when **at least one** name is active |
| Negatives only (for example `["!!related"]`) | Allowed for any active set **except** the negated names |
| Mix of positives and negatives | Negatives exclude first; then at least one positive must be active |

Negate a name with the `!!` prefix. Empty entries after trim are skipped.

Spell names exactly as defined by the consumer. An unknown allowlist name never matches (the filtered unit stays inactive for every active set that does not include that name).

## Consumers

| Consumer | Active names | Filter fields |
| -------- | ------------ | ------------- |
| Content Manager | Mapped-page names from `getActivePages()` | View/listing `pageFilter` — [Page filter](../modules/content-manager.md#page-filter) |
| History | Content Manager view/listing **`name`** values on the entry | `recordFilter` / `decorateFilter` — [Name filters](../modules/history.md#name-filters) |

## Contributors

Runtime helper: `passesPageFilter` in `src/supermonkey/utils/page-filter.ts`.

```ts
import { passesPageFilter } from "../utils/page-filter";

passesPageFilter(["home", "!!settings"], ["home"]); // true
passesPageFilter(["!!related"], ["related"]); // false
passesPageFilter(["catalog"], ["detail"]); // false
```

## See also

- [Content Manager - Page filter](../modules/content-manager.md#page-filter)
- [History - Name filters](../modules/history.md#name-filters)
- [Mapped pages](../integrations/editor-ui.md#mapped-pages) · [Mapped pages (TypeScript)](../integrations/README.md#mapped-pages-typescript)
- [Integration DSL](../integrations/dsl.md)
- [Opts normalization](./opts-normalization.md)
