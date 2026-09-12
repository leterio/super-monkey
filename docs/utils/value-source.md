# Value source

`ValueSource` extracts a string from the page or the tab URL. Content Manager uses it for view `idSource` and listing `entryIdSource`. In the editor, the **Source** dropdown and map steps serialize to the shapes below.

`resolveValue(source, element?)` returns a non-empty string, or `null` when the source cannot produce one. Optional `map` steps run after the raw read.

## In the editor

In the [Integration editor](../integrations/editor-ui.md) **Content Manager** panel (and other panels that use the same control), the **Source** dropdown maps to these kinds:

| Editor label    | `source` value |
| --------------- | -------------- |
| Attribute       | `attribute`    |
| Text            | `text`         |
| Srcset          | `srcset`       |
| Query parameter | `query-param`  |
| URL path        | `path`         |

Optional **Selectors** (element sources only: Attribute, Text, Srcset) — comma-separated CSS selectors — serialize to `selectors`. Empty uses the caller’s base element. Document steps in Resources Downloader **Download modes** require at least one selector (the control hides Query parameter and URL path there).

Optional **Map steps** serialize to the `map` array described under [Mappers](#mappers).

| Editor **Step type** | `type` value |
| -------------------- | ------------ |
| Extract (regex)      | `extract`    |
| Replace (regex)      | `replace`    |
| JSON path            | `json_path`  |
| Sort                 | `sort`       |
| Pick                 | `pick`       |

**Regexes** (one pattern per line) → `regexes`. **Capture group** → `captureGroup`. **Replacement** → `replacement`. **Path** → `path`. Sort **Order** Ascending/Descending → `order` `asc`/`desc`; **Sort by** Field path / Area → `by`; **Pick** first/last → `at`.

For the Content Manager create and save flow, see [Content Manager - In the editor](../modules/content-manager.md#in-the-editor).

**Attribute `data-id`:**

```json
{
  "source": "attribute",
  "attributes": ["data-id"]
}
```

**Href + extract map for query `v=`:**

```json
{
  "source": "attribute",
  "attributes": ["href"],
  "map": [
    {
      "type": "extract",
      "regexes": ["[?&]v=([^&]+)"],
      "captureGroup": 1
    }
  ]
}
```

## When to use which source

| `source`      | What you set                                                                                                                                                                                                        | What you get                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `attribute`   | `attributes` (tried in order), optional `selectors`, optional `map`                                                                                                                                                 | First non-empty attribute on the **base element**, or on the **first** match under `selectors` |
| `text`        | optional `selectors`, optional `map`                                                                                                                                                                                | Trimmed text content of that base element, or of the **first** match under `selectors`         |
| `srcset`      | optional `attributes` (defaults to `KNOWN_IMG_SRCSET_ATTRIBUTES`: `["data-lazy-srcset", "data-srcset", "srcset"]`), optional `resolution` (`high` / `low` / exact descriptor), optional `selectors`, optional `map` | URL picked from a srcset-like attribute on the base element, or on the **first** match under `selectors` |
| `query-param` | `key`, optional `map`                                                                                                                                                                                               | First value of that query parameter on the **current tab URL**                                |
| `path`        | optional `map`                                                                                                                                                                                                      | Pathname of the current tab (`/watch`, `/shorts/abc`, ...)                                    |

### Element sources

**Element sources** (`attribute`, `text`, `srcset`) need a base element from the feature, or `selectors` when resolving under a document or subtree (for example Resources Downloader custom mode steps). On a listing card the base is usually the matched entry node; on a view page it may be a node the feature selected with its own selectors.

#### Attribute source

Reads named attributes in order from the base element, or from the first match under `selectors`.

#### Text source

Reads trimmed text content from the base element, or from the first match under `selectors`.

#### Srcset source

Picks a URL from a srcset-like attribute. Default attribute order comes from `KNOWN_IMG_SRCSET_ATTRIBUTES`. Optional `resolution` selects `high`, `low`, or an exact descriptor.

### URL sources

**URL sources** (`query-param`, `path`) always read `window.location`. Use them when the id or token lives in the address bar (for example `?v=` on a watch page).

#### Query parameter source

Reads the first value of `key` from the current tab query string.

#### Path source

Reads the pathname of the current tab.

Use `attribute` (and `map` when you must carve an id out of a longer value) when the string sits on an element attribute, including an `href`. Use `srcset` when the URL lives in a srcset or `data-*` srcset attribute.

When nothing non-empty can be read, resolution yields no value (`null` at runtime). `resolveValue` uses only the first selector match. `resolveAllValues` returns every distinct match when a document step can produce multiple URLs.

## Sources

| `source`      | Reads                                                                                           | Needs element |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------- |
| `attribute`   | First non-empty value among `attributes`                                                        | Yes           |
| `text`        | Trimmed `textContent`                                                                           | Yes           |
| `srcset`      | URL from a srcset-like attribute (`resolution`: `"high"` default, `"low"`, or exact descriptor) | Yes           |
| `query-param` | `window.location` search param `key`                                                            | No            |
| `path`        | `window.location.pathname`                                                                      | No            |

Element sources accept optional `selectors`. When present, they query under the caller element (or document). When omitted, the caller must pass an `HTMLElement`.

URL sources ignore the element argument.

## Mappers

`map` is an ordered list. Structured mappers parse JSON when the current value is a string.

| `type`      | Role                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------- |
| `extract`   | First matching regex in `regexes`; optional `captureGroup` (default `1`).                |
| `replace`   | First matching regex; `replacement` string.                                              |
| `json_path` | Dotted path (`a.b.0.c`) on a JSON value.                                                 |
| `sort`      | Sort an array by field `path` or width×height `area`; `order` `asc` (default) or `desc`. |
| `pick`      | `at`: `"first"` or `"last"` entry of an array.                                           |

The chain returns a string (or stringifies a number/boolean). It returns `null` when a step cannot produce a value.

Unknown JSON is cleaned by `normalizeValueSource` / `normalizeValueSources` before load. See [Opts normalization](./opts-normalization.md#value-sources).

## Where it shows up

Features that accept a `ValueSource` (or a list of them) document their own fields. Typical consumers:

- [Content Manager](../modules/content-manager.md) - view `idSource` and listing `entryIdSource`
- [Resources Downloader](../modules/resources-downloader.md) - leaf `urlSources` and custom download steps
- [Additional Pages](../modules/additional-pages.md) - optional `urlTemplate.source` for numbered URL templates

## Contributors

Runtime: `src/supermonkey/utils/value-resolver.ts` (`resolveValue`, `resolveAllValues`). Normalization: [Opts normalization - Value sources](./opts-normalization.md#value-sources).

## See also

- [Opts normalization](./opts-normalization.md)
- [Content Manager](../modules/content-manager.md)
