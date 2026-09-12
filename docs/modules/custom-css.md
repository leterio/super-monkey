# Custom CSS

Custom CSS (`module: "CustomCss"`) applies integration-authored styles on the live page: always-on CSS at construction and optional Configuration Menu controls that inject CSS from stored preferences.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `CustomCss` and fill **Static CSS** and/or **Rules**. How preferences appear in the menu: [Configuration](./configuration.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page       | Reference                                             |
| ------------------ | ----------------------------------------------------- |
| Editor options     | [Options shape](#options-shape)                       |
| Editor walkthrough | [In the editor (Pattern A)](#in-the-editor-pattern-a) |
| TypeScript wiring  | [TypeScript wiring](#typescript-wiring)               |
| Prerequisites      | [Before you enable it](#before-you-enable-it)         |
| Minimum viable     | [Minimum viable setup](#minimum-viable-setup)         |
| Choosing shape     | [Pick a styling shape](#pick-a-styling-shape)         |
| Full opts          | [What you configure](#what-you-configure)             |
| Always-on CSS      | [Static CSS](#static-css)                             |
| User-tunable CSS   | [Rules](#rules) · [Rule types](#rule-types)           |
| Stable DOM hooks   | [Stable styling hooks](#stable-styling-hooks)         |
| Opts walk          | [Normalization](#normalization)                       |

## Options shape

Stored and TypeScript integrations use this opts object (`module: "CustomCss"`). The browser editor exposes **Static CSS** and a **Rules** list with typed rule fields. At least one of a non-empty `static` string or a non-empty `rules` array is required.

**Minimum - always-on CSS:**

```json
{
  "static": ":root { --sm-nb-offset-top: 3.5em; }\n.feed > hr { display: none !important; }"
}
```

**One boolean toggle in the Configuration Menu:**

```json
{
  "rules": [
    {
      "type": "boolean",
      "key": "decorate-history",
      "label": "Decorate viewed or listed items",
      "defaultValue": true,
      "css": "[data-sm-history=\"listed\"] .card { border-left: 0.15em solid yellow; }\n[data-sm-history=\"viewed\"] .card { border-left: 0.15em solid red; }"
    }
  ]
}
```

**Static plus a number rule:**

```json
{
  "static": ":root { --sm-nb-offset-top: 3.5em; }",
  "rules": [
    {
      "type": "number",
      "key": "imageSize",
      "label": "Image size",
      "min": 10,
      "max": 200,
      "defaultValue": 100,
      "css": ".thumb { width: {{VALUE}}%; height: {{VALUE}}%; }"
    }
  ]
}
```

Full field table: [What you configure](#what-you-configure). Stable markers for History and Content Manager: [Stable styling hooks](#stable-styling-hooks).

## In the editor (Pattern A)

1. In **Modules**, add an instance named `siteCss` with **Module key** `CustomCss`.
2. Set **Static CSS** from the [Options shape](#options-shape) minimum example, or add a **Rule** for Configuration Menu toggles.
3. To decorate History markers, target `[data-sm-history="viewed"]`, `[data-sm-history="listed"]`, and `[data-sm-history="unread"]` in Static CSS or rule CSS - pair with [History](./history.md).
4. Save, reload, and confirm styles apply (or the new Configuration Menu control appears for rules).
5. If **Save** fails validation, fix the opts fields - `validateIntegration` runs Custom CSS opts normalization at Save time; empty opts (no usable static and no rules) reject and block Save ([editor validation](../integrations/editor-ui.md#validation)).
6. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md) - unknown module key, rejected opts at load, or constructor failure skips that instance.

## TypeScript wiring

Register the constructor key `CustomCss` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "CustomCss"` and the opts below. Source: `src/supermonkey/modules/custom-css/`.

**Pattern A - Always-on site CSS:**

```ts
modules: {
  siteCss: {
    module: "CustomCss",
    opts: {
      static: `
:root { --sm-nb-offset-top: 3.5em; }
.feed > hr { display: none !important; }
`,
    },
  },
},
```

**Pattern B - One boolean toggle in the Configuration Menu:**

```ts
modules: {
  siteCss: {
    module: "CustomCss",
    opts: {
      rules: [{
        type: "boolean",
        key: "decorate-history",
        label: "Decorate viewed or listed items",
        defaultValue: true,
        css: `
[data-sm-history="listed"] .card { border-left: 0.15em solid yellow; }
[data-sm-history="viewed"] .card { border-left: 0.15em solid red; }
`,
      }],
    },
  },
},
```

**Pattern C - Static plus tunable rules:**

```ts
modules: {
  siteCss: {
    module: "CustomCss",
    opts: {
      static: `:root { --sm-nb-offset-top: 3.5em; }`,
      rules: [
        {
          type: "number",
          key: "imageSize",
          label: "Image size",
          min: 10,
          max: 200,
          defaultValue: 100,
          css: ".thumb { width: {{VALUE}}%; height: {{VALUE}}%; }",
        },
        {
          type: "options",
          key: "fontSize",
          label: "Font size",
          defaultValue: "16px",
          options: [
            { label: "Small", value: "14px" },
            { label: "Medium", value: "16px" },
            { label: "Large", value: "20px" },
          ],
          css: "body { font-size: {{VALUE}}; }",
        },
      ],
    },
  },
},
```

Menu-backed rules appear under this module instance in the Configuration Menu - see [Configuration](./configuration.md#style-mixin).

## Before you enable it

Provide **at least one** of:

- **`static`** - non-empty CSS string injected into `document.head` when the module constructs.
- **`rules`** - non-empty array of typed rules; each becomes a stored configuration that injects CSS from its value.

Custom CSS does not depend on Content Manager. Styles apply at construction; rule-backed styles follow stored preferences and style mixin updates.

`ModuleLoader` runs `normalizeCustomCssOpts` before construction. With no usable `static` and no remaining rules after the walk, opts **reject** (no instance).

## Minimum viable setup

Use the [Options shape](#options-shape) examples in the editor, or the TypeScript wiring above for built-ins.

### Pattern A - Always-on site CSS

Use for layout fixes, Notification Bar offsets, and styles that should not be user-toggled.

### Pattern B - One toggle in the Configuration Menu

Use when the user should turn a style pack on or off (for example History decoration).

### Pattern C - Static plus tunable rules

Combine always-on CSS with menu-backed rules.

## Pick a styling shape

| Goal                                            | Put it in                      | Appears in Configuration Menu |
| ----------------------------------------------- | ------------------------------ | ----------------------------- |
| Always apply (offsets, hide chrome, fix layout) | `static`                       | No                            |
| User on/off style pack                          | `rules` with `type: "boolean"` | Yes (toggle)                  |
| User picks a numeric CSS value                  | `rules` with `type: "number"`  | Yes (number)                  |
| User picks among fixed CSS snippets/values      | `rules` with `type: "options"` | Yes (select)                  |

## What you configure

Top-level opts (`CustomCssOpts`):

| Field    | Required | What you set                                       |
| -------- | -------- | -------------------------------------------------- |
| `static` | no\*     | Raw CSS string injected once at construction       |
| `rules`  | no\*     | Array of typed runtime rules (see [Rules](#rules)) |

\* At least one of a non-empty `static` string or a non-empty usable `rules` array is required.

## Static CSS

Injected once into `document.head` when the module constructs. There is no stored preference and no menu row for `static`.

Typical uses:

- Notification Bar spacing: `--sm-nb-offset-top` / `--sm-nb-offset-bottom` on `:root`
- Hiding site chrome or normalizing borders around Super Monkey decorations

Whitespace-only `static` is treated as absent.

## Rules

Each rule needs a unique `key` (`[A-Za-z0-9_-]+`), a non-empty `css` string, and a `type`.

| Field          | Required | What you set                                                               |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `type`         | yes      | `"boolean"`, `"number"`, or `"options"`                                    |
| `key`          | yes      | Storage key segment for the configuration (unique per Custom CSS instance) |
| `css`          | yes      | CSS to inject; use `{{VALUE}}` for `number` and `options`                  |
| `label`        | no       | Configuration Menu label (defaults to `key`)                               |
| `description`  | no       | Optional help text in the menu                                             |
| `defaultValue` | no       | Default stored value (see [Rule types](#rule-types))                       |

Duplicate or invalid keys are dropped during normalization.

### Rule types

| `type`      | Menu control | How `css` is applied                                                          | Defaults / extras                                                                                                                         |
| ----------- | ------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `"boolean"` | Toggle       | On → inject `css` as written; off → clear that style                          | `defaultValue` defaults to `true` when omitted                                                                                            |
| `"number"`  | Number       | Inject `css` with every `{{VALUE}}` replaced by the number                    | `defaultValue` defaults to `0` when omitted; optional finite `min` / `max`                                                                |
| `"options"` | Select       | Inject `css` with every `{{VALUE}}` replaced by the selected option’s `value` | `options: { label, value }[]` required (non-empty); `defaultValue` defaults to the first option’s `value` (must match a `value` when set) |

The placeholder token is **`{{VALUE}}`**. Unknown tokens are left unchanged.

Style mixin behavior: [Configuration - Style mixin](./configuration.md#style-mixin).

## Stable styling hooks

Super Monkey and feature modules expose stable attributes you can target from `static` or `rules`:

| Attribute                 | Set by               | Values / meaning                              |
| ------------------------- | -------------------- | --------------------------------------------- |
| `data-sm-history`         | History              | `viewed`, `listed`, or `unread`               |
| `data-sm-has-new-content` | History              | `"true"` when a new content selector matched  |
| `data-sm-cm-viewed`       | Content Manager      | Space-separated group keys on view elements   |
| `data-sm-cm-listed`       | Content Manager      | Space-separated group keys on listing entries |
| `data-sm-cm-<group>-id`   | Content Manager      | Resolved id for a listing entry in `group`    |
| `data-sm-rd-mapped-by`    | Resources Downloader | Mapping key that claimed the element                   |
| `data-sm-rd-decorated-by` | Resources Downloader | Mapping key that attached a download control           |
| `data-sm-rd-state`        | Resources Downloader | Resource item state (`pending`, `progress`, `done`, …) |

Notification Bar layout variables: `--sm-nb-offset-top`, `--sm-nb-offset-bottom` on `:root`.

## Normalization

`normalizeCustomCssOpts(raw)` returns [`Normalized<CustomCssOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/custom-css/custom-css-opts.ts`).

| Outcome    | When                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object; no non-empty `static` and no usable rules remain.                                                                                                               |
| **Repair** | Non-string or whitespace-only `static` dropped; `rules` not an array dropped; per-rule fixes (bad `type`, empty `css`, invalid `key`, duplicate keys, empty `options`, bad `defaultValue`). |

The loader constructs `CustomCss` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Put always-on layout and site fixes in `static`.
- Use `rules` when the user should toggle or tune styles from the Configuration Menu.
- Keep rule `key` values unique within the instance.
- Target History markers with `[data-sm-history="viewed"]`, `[data-sm-history="listed"]`, and `[data-sm-history="unread"]` when pairing with [History](./history.md).

## Full example

Always-on offsets plus a History decoration toggle:

```ts
import { Integration } from "../metadata";

export const MYSITE_COM_INTEGRATION: Integration = {
  name: "mysite_com",
  matchedDomains: ["mysite.com"],
  contentManager: {
    groups: {
      posts: {
        listings: [
          {
            name: "feed",
            containerSelectors: [".item-list"],
            entriesSelectors: [".item"],
            entryIdSource: [{ source: "attribute", attributes: ["data-id"] }],
          },
        ],
      },
    },
  },
  modules: {
    siteCss: {
      module: "CustomCss",
      opts: {
        static: `
:root { --sm-nb-offset-top: 3.5em; }
.feed > hr { display: none !important; }
`,
        rules: [
          {
            type: "boolean",
            key: "decorate-history",
            label: "Decorate viewed or listed items",
            defaultValue: true,
            css: `
[data-sm-history="listed"] .card { border-left: 0.15em solid yellow; }
[data-sm-history="viewed"] .card { border-left: 0.15em solid red; }
`,
          },
        ],
      },
    },
  },
};
```

## See also

- [History](./history.md)
- [Configuration](./configuration.md)
- [Content Manager](./content-manager.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Integration DSL](../integrations/dsl.md)
- [TypeScript integration](../integrations/README.md)
- [Modules overview](./README.md)
