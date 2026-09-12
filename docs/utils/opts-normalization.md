# Opts normalization

Loaders accept unknown JSON and produce a cleaned value plus **findings**. The walk lives in `src/supermonkey/utils/opts/normalization.ts`.

## Result

```ts
type Normalized<T> = {
    readonly value?: T;
    readonly findings: readonly OptsFinding[];
};

type OptsFinding = {
    readonly path: string;
    readonly message: string;
    readonly kind: "reject" | "repair";
};
```

`OptsNormalization` collects findings during one walk:

| Call                         | Effect                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `repair(path, message)`      | Records a fix. The walk may still finish with a `value`.               |
| `reject(path, message)`      | Records a hard failure. `finish` omits `value`.                        |
| `finish(value)`              | Returns `{ value, findings }` when there is no reject and `value` is set. Otherwise `{ findings }` only. |

`formatOptsFinding` turns each finding into a loader log line (`\n - path: message`).

A present `value` with findings is **repaired** and still used. A missing `value` is **rejected**. Owners log repairs as WARN and rejections as FATAL (or skip, for the registry).

## Field helpers

`src/supermonkey/utils/opts/opts-fields.ts`:

| Helper                       | Behavior                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `readStringList`             | Trims a string array. A non-array value is a repair. Empty or non-string *entries* inside an array are repaired away. A wholly empty list is omitted by default (`onEmpty: "omit"`); it repairs only when `required` or `onEmpty: "repair"`. |
| `readOptionalFiniteNumber`   | Keeps a finite number; otherwise repair and `undefined`.                 |

## Value sources

`normalizeValueSource` / `normalizeValueSources` (`src/supermonkey/utils/opts/value-resolver-opts.ts`) walk one or many [value sources](./value-source.md). Unusable entries are dropped as repairs. A required list that ends empty records a repair.

`srcset` with no usable `attributes` list uses the known img srcset attribute names. Invalid regexes in `extract` / `replace` are dropped; at least one compilable pattern is required.

## Who normalizes

| Owner                         | Function                            | When `value` is missing                                      |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `IntegrationsRegistry`        | `normalizeStoredIntegration`        | Skip that built-in or stored entry; log the findings.        |
| `ContentManagerLoader`        | `normalizeContentManagerOpts`       | FATAL; Content Manager stays off.                            |
| `ModuleLoader`                | per-module `optsNormalizer`         | FATAL for that instance; other modules still load.           |
| Additional Pages              | `normalizeAdditionalPagesOpts`      | FATAL for that instance; see [Additional Pages](../modules/additional-pages.md#normalization). |
| Custom CSS                    | `normalizeCustomCssOpts`            | FATAL for that instance; see [Custom CSS](../modules/custom-css.md#normalization). |
| History                      | `normalizeHistoryOpts`             | FATAL for that instance; see [History](../modules/history.md#normalization). |
| JS Snippets                  | `normalizeJsSnippetsOpts`          | FATAL for that instance; see [JS Snippets](../modules/js-snippets.md#normalization). |
| Keyboard Navigation           | `normalizeKeyboardNavigationOpts`   | FATAL for that instance; see [Keyboard Navigation](../modules/keyboard-navigation.md#normalization). |
| Resources Downloader          | `normalizeResourcesDownloaderOpts`  | FATAL for that instance; see [Resources Downloader](../modules/resources-downloader.md#normalization). |

When a module has no `optsNormalizer`, `ModuleLoader` passes a plain `opts` object or `{}`.

`validateContentManagerOpts(raw)` returns only the findings from `normalizeContentManagerOpts`.

## See also

- [Content Manager](../modules/content-manager.md#normalization)
- [Additional Pages](../modules/additional-pages.md#normalization)
- [Custom CSS](../modules/custom-css.md#normalization)
- [History](../modules/history.md#normalization)
- [JS Snippets](../modules/js-snippets.md#normalization)
- [Keyboard Navigation](../modules/keyboard-navigation.md#normalization)
- [Resources Downloader](../modules/resources-downloader.md#normalization)
- [TypeScript integration](../integrations/README.md#normalization)
- [Value source](./value-source.md)
