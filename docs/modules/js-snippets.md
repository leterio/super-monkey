# JS Snippets

JS Snippets (`module: "JsSnippets"`) runs integration-authored JavaScript on selected lifecycle and Content Manager hooks. Each rule is an opt-in Configuration Menu toggle (default off). Snippets run without SuperMonkey module context: `contentLoaded` receives no arguments; other listeners receive a payload binding named `event`.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `JsSnippets` and add **Rules**. How preferences appear in the menu: [Configuration](./configuration.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page       | Reference                                             |
| ------------------ | ----------------------------------------------------- |
| Editor options     | [Options shape](#options-shape)                       |
| Editor walkthrough | [In the editor (Pattern A)](#in-the-editor-pattern-a) |
| TypeScript wiring  | [TypeScript wiring](#typescript-wiring)               |
| Prerequisites      | [Before you enable it](#before-you-enable-it)         |
| Full opts          | [What you configure](#what-you-configure)             |
| Listeners          | [Listeners and event](#listeners-and-event)           |
| Runtime toggles    | [Runtime configurations](#runtime-configurations)     |
| Opts walk          | [Normalization](#normalization)                       |

## Options shape

Stored and TypeScript integrations use this opts object (`module: "JsSnippets"`). The browser editor exposes a **Rules** list. At least one usable rule is required.

**Minimum - one contentLoaded snippet:**

```json
{
  "rules": [
    {
      "name": "hide-ads",
      "label": "Hide ads banner",
      "listener": "contentLoaded",
      "code": "document.querySelector('.ads')?.remove();"
    }
  ]
}
```

**Hide listed entities during parse:**

```json
{
  "rules": [
    {
      "name": "hide-promoted",
      "label": "Hide promoted rows",
      "description": "Sets hide on entities whose element has class promoted.",
      "listener": "entitiesParsed",
      "code": "for (const list of event.entities.values()) {\n  for (const entity of list) {\n    if (entity.element.classList.contains('promoted')) {\n      entity.hide = true;\n    }\n  }\n}"
    }
  ]
}
```

Full field table: [What you configure](#what-you-configure). Listener bindings: [Listeners and event](#listeners-and-event).

## In the editor (Pattern A)

1. In **Modules**, add an instance named `siteSnippets` with **Module key** `JsSnippets`.
2. Add a **Rule** with **Name**, **Label**, **Listener**, and **Code** from the [Options shape](#options-shape) minimum example.
3. Save, reload, open Configuration, enable the toggle for that rule, and confirm the snippet runs on the selected hook.
4. If **Save** fails validation, fix the opts fields - `validateIntegration` runs JS Snippets opts normalization at Save time; empty opts (no usable rules) reject and block Save ([editor validation](../integrations/editor-ui.md#validation)).
5. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md) - unknown module key, rejected opts at load, or constructor failure skips that instance.

## TypeScript wiring

Register the constructor key `JsSnippets` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "JsSnippets"` and the opts below. Source: `src/supermonkey/modules/js-snippets/`.

**Pattern A - DOM tweak on content loaded:**

```ts
modules: {
  siteSnippets: {
    module: "JsSnippets",
    opts: {
      rules: [{
        name: "hide-ads",
        label: "Hide ads banner",
        listener: "contentLoaded",
        code: "document.querySelector('.ads')?.remove();",
      }],
    },
  },
},
```

**Pattern B - Set `hide` during entitiesParsed:**

```ts
modules: {
  siteSnippets: {
    module: "JsSnippets",
    opts: {
      rules: [{
        name: "hide-promoted",
        label: "Hide promoted rows",
        listener: "entitiesParsed",
        code: `
for (const list of event.entities.values()) {
  for (const entity of list) {
    if (entity.element.classList.contains("promoted")) {
      entity.hide = true;
    }
  }
}
`,
      }],
    },
  },
},
```

Each rule appears as a boolean preference in the Configuration Menu (default off) - see [Runtime configurations](#runtime-configurations).

## Before you enable it

Provide a non-empty `rules` array. Each usable rule needs a valid `name`, non-empty `label`, a known `listener`, and non-empty `code`.

Entity listeners require Content Manager on the integration. `contentLoaded` also depends on Content Manager publishing that event. `beforeUnload` runs for the tab unload hook.

`ModuleLoader` runs `normalizeJsSnippetsOpts` before construction. With no usable rules after the walk, opts **reject** (no instance).

## What you configure

| Field                     | Role                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `rules`                   | Non-empty list of snippet rules                                      |
| `rules[].name`            | Valid id segment; unique per instance; Configuration storage key     |
| `rules[].label`           | Configuration Menu label                                             |
| `rules[].description`     | Optional Configuration Menu description                              |
| `rules[].listener`        | Hook that runs the snippet when the toggle is on                     |
| `rules[].code`            | JavaScript body compiled once at construction                        |

## Listeners and event

| `listener`         | Hook                 | Binding                                      |
| ------------------ | -------------------- | -------------------------------------------- |
| `contentLoaded`    | `onContentLoaded`    | None (use page `document` / `window`)        |
| `beforeUnload`     | `onBeforeUnload`     | `event` — `BeforeUnloadEventPayload`         |
| `entityViewed`     | `onEntityViewed`     | `event` — `EntityViewedEventPayload`         |
| `entitiesParsed`   | `onEntitiesParsed`   | `event` — `EntitiesParsedEventPayload`       |
| `entitiesInjected` | `onEntitiesInjected` | `event` — `EntitiesInjectedEventPayload`     |

Snippets compile with `new Function`. They do not close over the module instance or SuperMonkey APIs.

For `entitiesParsed`, the only writable field on each listed entity is `hide`. Other payload properties are read-only. Remaining listeners receive a read-only `event` binding; DOM nodes reached through `element` remain normal page nodes.

Compile failure for a rule logs FATAL and drops that rule. Runtime exceptions log WARN and leave other rules and the content pipeline running.

Rules for the same listener run in array order.

## Runtime configurations

Each rule exposes a boolean Configuration entry:

| Key        | Default | Role                                      |
| ---------- | ------- | ----------------------------------------- |
| rule `name` | `false` | When `true`, the snippet runs on its listener |

Storage key: `{integration}::{instance}::{name}`. See [Configuration](./configuration.md).

## Normalization

`normalizeJsSnippetsOpts` rejects non-object opts and opts with no usable rules. Unusable rules (invalid `name`, duplicate `name`, empty `label`, unknown `listener`, empty `code`) are dropped as repairs. Duplicate names keep the first usable rule.

## See also

- [Modules overview](./README.md)
- [Authoring a module](./authoring.md)
- [Content Manager](./content-manager.md)
- [Configuration](./configuration.md)
- [Custom CSS](./custom-css.md)
- [Script lifecycle](../supermonkey/lifecycle.md)
