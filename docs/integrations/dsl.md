# Integration DSL

Shared matching rules for **Matched domains** (hostnames) and **Mapped pages** paths in the [Integration editor](./editor-ui.md).

In the editor, **Matched domains**, **Mapped pages** → **Paths**, and selector lists are comma-separated fields. Prefix exclusions with `!!`.

## Stored / editor shape

**Share**, **Import**, and **Save** use the same JSON object. Minimal example:

```json
{
  "name": "xpto_platform",
  "matchedDomains": ["xpto.com", "www.xpto.com"]
}
```

| Field | Editor | JSON |
| ----- | ------ | ---- |
| Name | **Name** | `name` |
| Matched domains | CSV (comma-separated) | `matchedDomains` string array |
| Mapped pages | foldable list (name + paths, CSV) | `mappedPages` |
| Content Manager | panel fields | `contentManager` |
| Modules | instance name, module key, typed opts fields | `modules` |
| Defaults | preserved on edit/import when present | `defaults` |

Full Atlas example: [Tutorial - Final stored JSON](./tutorial.md#final-stored-json). Field contracts: [TypeScript integration](./README.md#integration-fields).

### Matched domains in the editor (CSV)

Enter hosts and globs separated by commas. Spaces around commas are fine.

| Goal | Editor **Matched domains** value |
| ---- | -------------------------------- |
| One host | `atlas.example.com` |
| Apex + www | `xpto.com, www.xpto.com` |
| Subdomains | `*.example.com, example.com` |
| Exclude ads host | `example.com, *.example.com, !!ads.example.com` |

The editor serializes the CSV into the `matchedDomains` array. At least one positive pattern is required.

## Multi-host, one integration

Put every hostname for the same service in **one** integration’s `matchedDomains` (one CSV field / one array). Typical reasons: apex + `www`, legacy and new UI hosts, or a peer domain on the same backend.

```json
{
  "name": "xpto_platform",
  "matchedDomains": [
    "xpto.com",
    "www.xpto.com",
    "new.xpto.com",
    "classic.xpto.com"
  ]
}
```

| URL | Matches |
| --- | ------- |
| `https://xpto.com/search` | yes |
| `https://new.xpto.com/posts/9` | yes |
| `https://ads.xpto.com/` | no (unless a pattern covers it) |

With a negation:

```text
xpto.com, www.xpto.com, *.xpto.com, !!ads.xpto.com
```

## Domain patterns

Matching is case-insensitive. `*` in a pattern matches any substring.

- At least one **positive** pattern must match the hostname.
- Any matching `!!` negation rejects the hostname.

`!!` prefixes a negation. Surrounding spaces are trimmed (`!!  foo` → `!!foo`).

## Valid domain patterns

After stripping a leading `!!`, a pattern is valid when:

- It is non-empty and not a bare `*`.
- Labels (dot-separated) are non-empty.
- The TLD has no `*`.
- At least one label above the TLD is not only `*`.

Rejected examples: `*`, `*.com`, `example.com.*`.

Accepted examples: `example.com`, `www.example.com`, `*.example.com`, `!!ads.example.com`.

Normalization of stored integrations keeps only valid patterns and requires at least one positive entry. See [TypeScript integration](./README.md#normalization).

## Path patterns

Mapped-page **Paths** are pathname globs with optional `!!` negations. `*` matches any substring. Patterns need not start with `/`. Matching is case-sensitive.

- At least one **positive** path must match the current pathname.
- Any matching `!!` negation rejects the page name for that URL.

Accepted examples: `/`, `/article/*`, `*/article/*`, `!!/settings`, `*/comments/*` with `!!/post/*/comments/*`.

Rejected examples: empty string, `!!` alone.

Editor UI: [Mapped pages](./editor-ui.md#mapped-pages). Multiple mapped pages may be active at once for one URL.

## Authoring checklist

1. Choose a stable `name` (one id segment).
2. List every hostname variant in `matchedDomains` (CSV in the editor, or `string[]` in TypeScript).
3. Add `!!` exclusions only for hosts that must never activate this integration.
4. Optional: define [mapped pages](./editor-ui.md#mapped-pages) ([TypeScript](./README.md#mapped-pages-typescript)) for distinct pathnames, then gate views/listings with [page filter](../modules/content-manager.md#page-filter).
5. Optional: `contentManager`, `modules`, and `defaults` (see module pages and [Defaults](#defaults)).
6. Persist and verify:
   - **Browser:** **Save** / **Import**, reload, confirm **active** in the Integrations Menu.
   - **Coded built-in:** append to `BuiltinIntegrations` in `builtin.ts`, rebuild or reload the userscript, open a matching host, confirm provenance **`builtin`** + **`active`**. See [Register a built-in integration](./README.md#register-a-built-in-integration).

## Defaults

`defaults` is an optional plain object preserved on Save/Import. Module and chrome owners read only the keys they own. Documented consumer today: [Notification Bar](../modules/notification-bar.md) (`defaults.notificationBar.position`).

## Contributors

Helpers: `hostnameMatchesDomains`, `isValidDomainPattern`, and `pathnameMatchesPaths` in `src/supermonkey/utils/urls.ts`; allow/deny pattern split and `!!` normalization in `src/supermonkey/utils/allow-deny.ts`; `createGetActivePages` in `src/supermonkey/integrations/mapped-pages.ts`. Normalization keeps valid patterns (including `!!`), requires at least one positive per page, and drops pages without usable positives. See [TypeScript integration](./README.md#normalization).
