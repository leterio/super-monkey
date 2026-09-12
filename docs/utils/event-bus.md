# Event bus

Process-wide publish/subscribe for lifecycle signals, Content Manager pipeline events, and optional cross-feature coordination. Use the **static** API on `EventBus` only.

Source lives under `src/supermonkey/event-bus/` (not under `utils/`). It is documented with Utils because it is a shared contract — the same grouping as [Utils overview](./README.md).

Types: `src/supermonkey/event-bus/event-bus.ts`. Lifecycle event names and payloads: `src/supermonkey/lifecycle/events.ts` and [Script Lifecycle](../supermonkey/lifecycle.md). Content Manager pipeline events: [Content Manager - Events](../modules/content-manager.md#events).

## Event type strings

Every `type` passed to `subscribe` or `publish` is **trimmed** and lowercased before lookup. Empty or non-string types are ignored; `EventBus` logs a warning and returns without registering or publishing.

Use stable strings such as `LifecycleAwareEvent.INTEGRATION_LOADED` → `"integration-loaded"`.

## Subscribe

```ts
EventBus.subscribe<T>(type: string, handler: EventBusEventHandler<T>): void
```

Registers an async handler for the normalized event type. Invalid types and non-function handlers are ignored with a warning.

`Component` and `Module` register lifecycle and content-pipeline subscriptions in their constructors ([Authoring a module](../modules/authoring.md)). Call `EventBus.subscribe` directly in a feature constructor for extra event types.

There is **no unsubscribe** API. Handlers remain registered for the tab lifetime.

Multiple handlers for the same type all receive publications.

## Publish

```ts
EventBus.publish<T>(type: string, data?: T): Promise<void>
```

Delivers `{ type, data }` to every handler for the normalized type **in parallel** (`Promise.all`). When no handlers are registered, `publish` resolves immediately.

Invalid types are ignored with a warning.

Handler rejections and thrown errors are **logged**; they do not reject `publish` or stop other handlers.

## Parallelism and nesting

Handlers for one `publish` run concurrently. Do not assume FIFO order among subscribers to the same type.

Content Manager publishes `CONTENT_LOADED` **from inside** its `onIntegrationLoaded` handler. While `INTEGRATION_LOADED` handlers are still running in parallel, `CONTENT_LOADED` (and Content Manager scans / `onContentLoaded` hooks) may already be in flight. Treat chrome setup on `INTEGRATION_LOADED` and content work on `CONTENT_LOADED` as overlapping unless you only need one of those hooks. Details: [Script Lifecycle - Handler interleaving](../supermonkey/lifecycle.md#handler-interleaving).

## Feature-to-feature example

Modules stay isolated: they do not import each other. Coordinate with a shared event type:

```ts
import { EventBus } from "../../event-bus/event-bus";
import { Module } from "../module";
import type { EntitiesInjectedEventPayload } from "../../content-manager/events";

const RESULTS_UPDATED = "results-updated";

type ResultsUpdated = {
  readonly count: number;
};

export class ResultsSummary extends Module {
  constructor(name: string, opts: object) {
    super(name, opts);
    EventBus.subscribe<ResultsUpdated>(RESULTS_UPDATED, async (event) => {
      if (event.data != null) {
        this.log.debug("count", event.data.count);
      }
    });
  }
}

export class ResultsCollector extends Module {
  protected override async onEntitiesInjected(
    data: EntitiesInjectedEventPayload,
  ): Promise<void> {
    const count = [...data.entities.values()].reduce((sum, list) => sum + list.length, 0);
    await EventBus.publish<ResultsUpdated>(RESULTS_UPDATED, { count });
  }
}
```

## Handler shape

```ts
type EventBusEvent<T> = { readonly type: string; readonly data?: T };
type EventBusEventHandler<T> = (event: EventBusEvent<T>) => Promise<void>;
```

## See also

- [Script Lifecycle](../supermonkey/lifecycle.md)
- [Authoring a module](../modules/authoring.md)
- [Content Manager](../modules/content-manager.md)
- [Logger](./logger.md)
- [Overview](../supermonkey/overview.md)
