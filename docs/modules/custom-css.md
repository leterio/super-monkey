# Custom CSS

Custom CSS (`module: "CustomCss"`) applies integration-authored styles on the live page: always-on CSS at construction and optional Configuration Menu controls that inject CSS from stored preferences.

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `CustomCss` and fill **Static CSS** and/or **Rules**. How preferences appear in the menu: [Configuration](./configuration.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page       | Reference                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Editor options     | [Options shape](#options-shape)                                                                                       |
| Editor walkthrough | [In the editor (Pattern A)](#in-the-editor-pattern-a) · [Pattern D - Shadow](#in-the-editor-pattern-d---shadow-roots) |
| TypeScript wiring  | [TypeScript wiring](#typescript-wiring)                                                                               |
| Prerequisites      | [Before you enable it](#before-you-enable-it)                                                                         |
| Minimum viable     | [Minimum viable setup](#minimum-viable-setup)                                                                         |
| Choosing shape     | [Pick a styling shape](#pick-a-styling-shape)                                                                         |
| Full opts          | [What you configure](#what-you-configure)                                                                             |
| Always-on CSS      | [Static CSS](#static-css)                                                                                             |
| User-tunable CSS   | [Rules](#rules) · [Rule types](#rule-types)                                                                           |
| Shadow roots       | [Shadow root rules](#shadow-root-rules)                                                                               |
| Stable DOM hooks   | [Stable styling hooks](#stable-styling-hooks)                                                                         |
| Opts walk          | [Normalization](#normalization)                                                                                       |

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

**Boolean rule that also styles inside open shadow roots:**

```json
{
  "rules": [
    {
      "type": "boolean",
      "key": "enlargeMediaWidget",
      "label": "Enlarge media widget",
      "defaultValue": false,
      "description": "Makes the site media widget taller when enabled.",
      "onEventType": "entitiesInjected",
      "shadowRootSelectors": ["media-host:shadowRoot"],
      "css": ".media-frame { max-height: 70vh; }"
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

## In the editor (Pattern D - Shadow roots)

Use when page CSS alone cannot reach inside a site widget that uses an **open** shadow root. Document injection still runs; shadow adoption is additional.

1. Configure [Content Manager](./content-manager.md) if **On event** will be `entityViewed`, `entitiesParsed`, or `entitiesInjected` (those hooks need CM events). `contentLoaded` also depends on Content Manager publishing content-ready.
2. Add a **Rule** (boolean, number, or options) with **Key**, **Label**, and **CSS** as usual.
3. Set **Shadow root selectors** to a comma-separated list of host chains ending with `:shadowRoot` (for example `media-host:shadowRoot`). Leave empty when you only want page CSS.
4. Set **On event** to the hook that should run shadow adoption. Choose **None (page CSS only)** when **Shadow root selectors** is empty.
5. Save, reload, enable the rule in the Configuration Menu, and confirm both the page styles and the widget interior update.

Field map: [Rules](#rules). Selector grammar: [Shadow root rules](#shadow-root-rules).

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

**Pattern D - Also style inside open shadow roots:**

```ts
modules: {
  siteCss: {
    module: "CustomCss",
    opts: {
      rules: [{
        type: "boolean",
        key: "enlargeMediaWidget",
        label: "Enlarge media widget",
        defaultValue: false,
        onEventType: "entitiesInjected",
        shadowRootSelectors: ["media-host:shadowRoot"],
        css: `
.media-frame { max-height: 70vh; }
`,
      }],
    },
  },
},
```

Menu-backed rules appear under this module instance in the Configuration Menu - see [Configuration](./configuration.md#style-mixin).

## Before you enable it

Provide **at least one** of:

- **`static`** - non-empty CSS string injected into `document.head` when the module constructs.
- **`rules`** - non-empty array of typed rules; each becomes a stored configuration that injects CSS from its value.

Document-only Custom CSS (no **Shadow root selectors**) does not require Content Manager. Every shadow **On event** value — including `contentLoaded` — needs Content Manager to publish the matching lifecycle or content event so adoption can run; page CSS from the same rule still applies without those events.

`ModuleLoader` runs `normalizeCustomCssOpts` before construction. With no usable `static` and no remaining rules after the walk, opts **reject** (no instance).

## Minimum viable setup

Use the [Options shape](#options-shape) examples in the editor, or the TypeScript wiring above for built-ins.

### Pattern A - Always-on site CSS

Use for layout fixes, Notification Bar offsets, and styles that should not be user-toggled.

### Pattern B - One toggle in the Configuration Menu

Use when the user should turn a style pack on or off (for example History decoration).

### Pattern C - Static plus tunable rules

Combine always-on CSS with menu-backed rules.

### Pattern D - Also style inside open shadow roots

Use [In the editor (Pattern D)](#in-the-editor-pattern-d---shadow-roots) when widgets use open shadow DOM. Pair **Shadow root selectors** with **On event**.

## Pick a styling shape

| Goal                                                                  | Put it in                                                                              | Appears in Configuration Menu |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| Always apply (offsets, hide chrome, fix layout)                       | `static`                                                                               | No                            |
| User on/off style pack                                                | `rules` with `type: "boolean"`                                                         | Yes (toggle)                  |
| User picks a numeric CSS value                                        | `rules` with `type: "number"`                                                          | Yes (number)                  |
| User picks among fixed CSS snippets/values                            | `rules` with `type: "options"`                                                         | Yes (select)                  |
| Also adopt the same CSS into open shadow roots on CM/lifecycle events | `rules` with `shadowRootSelectors` + `onEventType` (in addition to document injection) | Yes (same type controls)      |

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

| Field (JSON / TypeScript) | Editor label              | Required | What you set                                                                                                                                                  |
| ------------------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                    | **Rule type**             | yes      | `"boolean"`, `"number"`, or `"options"`                                                                                                                       |
| `key`                     | **Key**                   | yes      | Storage key segment (unique per Custom CSS instance)                                                                                                          |
| `css`                     | **CSS**                   | yes      | CSS for the page stylesheet; use `{{VALUE}}` for `number` and `options`. The same string is adopted into matching open shadows when shadow fields are set     |
| `label`                   | **Label**                 | no       | Configuration Menu label (defaults to `key`)                                                                                                                  |
| `description`             | **Description**           | no       | Optional help text in the Configuration Menu                                                                                                                  |
| `defaultValue`            | **Default**               | no       | Default stored value (see [Rule types](#rule-types))                                                                                                          |
| `shadowRootSelectors`     | **Shadow root selectors** | no\*     | Comma-separated host chains ending with `:shadowRoot` (see [Shadow root rules](#shadow-root-rules))                                                           |
| `onEventType`             | **On event**              | no\*     | Hook for shadow adoption: `contentLoaded`, `entityViewed`, `entitiesParsed`, or `entitiesInjected`. Empty / **None (page CSS only)** when selectors are empty |

- When **Shadow root selectors** is non-empty, **On event** is required. Page (document) injection always runs; shadow adoption is additional.

Duplicate or invalid keys are dropped during normalization. Rules with `shadowRootSelectors` but no valid `onEventType` are dropped.

### Rule types

| `type`      | Menu control | How `css` is applied                                                          | Defaults / extras                                                                                                                         |
| ----------- | ------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `"boolean"` | Toggle       | On → inject `css` as written; off → clear that style                          | `defaultValue` defaults to `true` when omitted                                                                                            |
| `"number"`  | Number       | Inject `css` with every `{{VALUE}}` replaced by the number                    | `defaultValue` defaults to `0` when omitted; optional finite `min` / `max`                                                                |
| `"options"` | Select       | Inject `css` with every `{{VALUE}}` replaced by the selected option’s `value` | `options: { label, value }[]` required (non-empty); `defaultValue` defaults to the first option’s `value` (must match a `value` when set) |

The placeholder token is **`{{VALUE}}`**. Unknown tokens are left unchanged.

Every rule uses the style mixin for document injection: [Configuration - Style mixin](./configuration.md#style-mixin). When `shadowRootSelectors` is also set, the same `css` is adopted into matching shadow roots on the selected event.

## Shadow root rules

**Shadow root selectors** is **additive**: the rule still injects **CSS** into the document. Matching **open** shadow roots also receive the same CSS via `ShadowRoot.adoptedStyleSheets` when **On event** runs. Closed shadow roots and missing hosts are no-ops for that selector.

### Selectors (`:shadowRoot`)

Each entry is an independent selector (comma-separated list in the editor; string array in JSON/TypeScript). A selector must end with `:shadowRoot` (optional space before the token: `foo :shadowRoot` ≡ `foo:shadowRoot`).

| Selector                                           | Meaning                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `media-host:shadowRoot`                            | Query `media-host` under the event base; adopt into that host’s `shadowRoot`                             |
| `outer-host:shadowRoot inner-host:shadowRoot`      | Enter `outer-host`’s shadow, then find `inner-host` inside it and adopt into `inner-host`’s `shadowRoot` |
| `:shadowRoot`                                      | Adopt into the base element’s own `shadowRoot` (no prior query)                                          |
| `a media-host:shadowRoot, b panel-host:shadowRoot` | Two independent targets                                                                                  |

Style descendants **inside** the landed shadow with the rule **CSS** (for example `.media-frame { max-height: 70vh; }`), not as a trailing query without `:shadowRoot`.

### Event bases (`onEventType` / **On event**)

| Value              | Editor label (short)                    | Query base                                          | Typical use                                                   |
| ------------------ | --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `contentLoaded`    | contentLoaded (document)                | `document`                                          | Shadows present once the page content is ready                |
| `entityViewed`     | entityViewed (viewed entity)            | `entity.element` when present, otherwise `document` | Shadows under the viewed item                                 |
| `entitiesParsed`   | entitiesParsed (each listed entity)     | each listed entity’s `element`                      | Shadows under listing entries as they are parsed              |
| `entitiesInjected` | entitiesInjected (each injected entity) | each remaining entity’s `element` after inject      | Shadows under entities after inject (common for feed widgets) |
| _(empty)_          | **None (page CSS only)**                | —                                                   | No shadow adoption; page CSS still runs                       |

Turning a boolean rule off clears the document style and removes previously adopted shadow sheets for that rule. Changing a value on a `contentLoaded` shadow rule re-queries `document`; entity-scoped rules apply on the next matching event.

### Example

```ts
{
  type: "boolean",
  key: "enlargeMediaWidget",
  defaultValue: false,
  label: "Enlarge media widget",
  onEventType: "entitiesInjected",
  shadowRootSelectors: ["media-host:shadowRoot"],
  css: `
.media-frame {
  max-height: 70vh;
}
`,
}
```

## Stable styling hooks

Super Monkey and feature modules expose stable attributes you can target from `static` or `rules`:

| Attribute                 | Set by               | Values / meaning                                       |
| ------------------------- | -------------------- | ------------------------------------------------------ |
| `data-sm-history`         | History              | `viewed`, `listed`, or `unread`                        |
| `data-sm-has-new-content` | History              | `"true"` when a new content selector matched           |
| `data-sm-cm-viewed`       | Content Manager      | Space-separated group keys on view elements            |
| `data-sm-cm-listed`       | Content Manager      | Space-separated group keys on listing entries          |
| `data-sm-cm-<group>-id`   | Content Manager      | Resolved id for a listing entry in `group`             |
| `data-sm-rd-mapped-by`    | Resources Downloader | Mapping key that claimed the element                   |
| `data-sm-rd-decorated-by` | Resources Downloader | Mapping key that attached a download control           |
| `data-sm-rd-state`        | Resources Downloader | Resource item state (`pending`, `progress`, `done`, …) |

Notification Bar layout variables: `--sm-nb-offset-top`, `--sm-nb-offset-bottom` on `:root`.

## Normalization

`normalizeCustomCssOpts(raw)` returns [`Normalized<CustomCssOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/custom-css/custom-css-opts.ts`).

| Outcome    | When                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object; no non-empty `static` and no usable rules remain.                                                                                                                                                                                                          |
| **Repair** | Non-string or whitespace-only `static` dropped; `rules` not an array dropped; per-rule fixes (bad `type`, empty `css`, invalid `key`, duplicate keys, empty `options`, bad `defaultValue`, `onEventType` without `shadowRootSelectors`, shadow selectors without valid `onEventType`). |

The loader constructs `CustomCss` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Put always-on layout and site fixes in `static`.
- Use `rules` when the user should toggle or tune styles from the Configuration Menu.
- Use **Shadow root selectors** + **On event** (`shadowRootSelectors` + `onEventType`) when the same rule CSS must also land inside open shadow roots (document injection still runs).
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
