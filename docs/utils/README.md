# Utils overview

Shared helpers under `src/supermonkey/utils/`. The table below is the **documented public contract** surface. Other files in that folder (for example `allow-deny`, `urls`, `dom/`, `ui/`, `network`) are implementation helpers unless a narrative page promotes them.

| Document                                      | Description                                                     |
| --------------------------------------------- | --------------------------------------------------------------- |
| [Value source](./value-source.md)             | Extract strings from the page or the tab URL                    |
| [Opts normalization](./opts-normalization.md) | `Normalized<T>`, reject / repair findings, and loader walks     |
| [Page filter](./page-filter.md)               | Allow/deny name lists (`passesPageFilter`)                      |
| [Event bus](./event-bus.md)                   | Process-wide pub/sub (`EventBus.subscribe` / `publish`)         |
| [Value storage](./value-storage.md)           | Typed Tampermonkey `getValue` / `setValue` / `watch`            |
| [Logger](./logger.md)                         | Console logger, levels, and `Logger.setLevel`                   |

Domain and path allow/deny matching is also described under [Integration DSL](../integrations/dsl.md).

## See also

- [Content Manager](../modules/content-manager.md)
- [History](../modules/history.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
- [TypeScript integration](../integrations/README.md)
- [TypeScript API index](../integrations/typescript-api.md)
