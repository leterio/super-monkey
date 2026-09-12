# Keyboard Navigation

Keyboard Navigation (`module: "KeyboardNavigation"`) clicks integration-authored prev/next page controls when the user presses configured key pairs (A/D, Numpad 4/6, and arrow keys).

In the [Integration editor](../integrations/editor-ui.md), set **Module key** to `KeyboardNavigation` and fill **Previous selectors** / **Next selectors** (comma-separated CSS selectors). How preferences appear in the menu: [Configuration](./configuration.md). Site matching: [Integration DSL](../integrations/dsl.md).

## Quick reference

| On this page      | Reference                                         |
| ----------------- | ------------------------------------------------- |
| Editor options    | [Options shape](#options-shape)                   |
| Editor walkthrough | [In the editor (Pattern A)](#in-the-editor-pattern-a) |
| TypeScript wiring | [TypeScript wiring](#typescript-wiring)           |
| Prerequisites     | [Before you enable it](#before-you-enable-it)     |
| Choosing shape    | [Pick a selector shape](#pick-a-selector-shape)   |
| Full opts         | [What you configure](#what-you-configure)         |
| Finding controls  | [Selectors](#selectors)                           |
| Runtime behavior  | [How navigation works](#how-navigation-works)     |
| User-facing knobs | [Runtime configurations](#runtime-configurations) |
| Opts walk         | [Normalization](#normalization)                   |

## Options shape

Stored and TypeScript integrations use this opts object (`module: "KeyboardNavigation"`). The browser editor exposes the same fields as comma-separated text inputs.

**Pattern A - Standard `rel` anchors:**

```json
{
  "previousSelectors": ["a[rel='prev']"],
  "nextSelectors": ["a[rel='next']"]
}
```

**Pattern B - Site pager classes:**

```json
{
  "previousSelectors": [".pager-prev", "a.prev"],
  "nextSelectors": [".pager-next", "a.next"]
}
```

Full field table: [What you configure](#what-you-configure). Key pairs the user can toggle: [Runtime configurations](#runtime-configurations).

## In the editor (Pattern A)

1. On a page that shows prev/next controls, use DevTools to confirm selectors that match those elements.
2. In **Modules**, add an instance with **Module key** `KeyboardNavigation`.
3. Set **Previous selectors** to `a[rel='prev']` and **Next selectors** to `a[rel='next']` (comma-separated when listing more than one), or use Pattern B selectors from [Options shape](#options-shape).
4. Save, reload, open Configuration, and confirm the **Keyboard Navigation** section lists the key-pair toggles. Press an enabled next key and confirm the next control activates.
5. If **Save** fails validation, fix the selector fields - `validateIntegration` runs Keyboard Navigation opts normalization at Save time ([editor validation](../integrations/editor-ui.md#validation)).
6. If the module is missing **after reload**, check FATAL `Failed to load module:` in [Runtime signals](../integrations/runtime-signals.md).

## TypeScript wiring

Register the constructor key `KeyboardNavigation` in `MAPPED_MODULES`. Wire an instance under `integration.modules` with `module: "KeyboardNavigation"` and the opts below. Source: `src/supermonkey/modules/keyboard-navigation/`.

**Pattern A - Standard `rel` anchors:**

```ts
modules: {
  keyboardNavigation: {
    module: "KeyboardNavigation",
    opts: {
      previousSelectors: ["a[rel='prev']"],
      nextSelectors: ["a[rel='next']"],
    },
  },
},
```

**Pattern B - Site pager classes with fallbacks:**

```ts
modules: {
  keyboardNavigation: {
    module: "KeyboardNavigation",
    opts: {
      previousSelectors: [".pager-prev", "a.prev"],
      nextSelectors: [".pager-next", "a.next"],
    },
  },
},
```

Which physical keys are active is a **user** preference in the Configuration Menu - see [Runtime configurations](#runtime-configurations).

## Before you enable it

Provide **both** non-empty selector lists:

- **`previousSelectors`** - CSS selectors for the previous-page control
- **`nextSelectors`** - CSS selectors for the next-page control

The site must expose clickable controls (links or buttons) that those selectors can match. Keyboard Navigation calls `.click()` on the first match; it does not invent URLs.

Keyboard Navigation does not depend on Content Manager. It registers a `keydown` listener on `onIntegrationLoaded`.

`ModuleLoader` runs `normalizeKeyboardNavigationOpts` before construction. Missing or empty `previousSelectors` / `nextSelectors` **reject** (no instance).

## Minimum viable setup

### Pattern A - Standard `rel` anchors

Use when the page exposes reliable `a[rel='prev']` / `a[rel='next']` (or equivalent) controls.

### Pattern B - Site pager classes

Use when the paginator uses custom classes or multiple fallback selectors. Lists are tried in order; the first match wins.

## Pick a selector shape

| Goal                                | What to set                                                             |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Follow standard prev/next links     | Pattern A `rel` selectors                                               |
| Match a custom paginator            | Pattern B with ordered fallbacks from DevTools                          |
| Let the user disable some key pairs | Leave opts as-is; use [Runtime configurations](#runtime-configurations) |

## What you configure

Top-level opts (`KeyboardNavigationOpts`):

| Field               | Required | What you set                                              |
| ------------------- | -------- | --------------------------------------------------------- |
| `previousSelectors` | yes      | Non-empty CSS selector list for the previous-page control |
| `nextSelectors`     | yes      | Non-empty CSS selector list for the next-page control     |

## Selectors

Both fields are string arrays. At navigation time the shared DOM `query` helper walks the list under `document` and returns the **first** matching element.

| Authoring tip | Detail                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Order matters | Put the most specific or reliable selector first                                                 |
| Fallbacks     | Later entries run only when earlier ones miss                                                    |
| Target        | Prefer the clickable control (`a`, `button`, or the node that already handles click on the site) |

## How navigation works

On `INTEGRATION_LOADED`, the module listens for `keydown` on `document`. Enabled key-pair preferences load from Configuration and stay current when the user changes them in the menu.

| Step           | Behavior                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Focus guard    | Events are ignored when focus is in `input`, `textarea`, `select`, or `contenteditable`                       |
| Modifier guard | Events are ignored when `Ctrl`, `Alt`, or `Meta` is held                                                      |
| Key mapping    | Only the enabled pairs map to prev/next ([Runtime configurations](#runtime-configurations))                   |
| Intercept      | When a mapped pair matches, the module calls `preventDefault` and `stopPropagation`                           |
| Debounce       | Navigation is scheduled with a **150 ms** debounce (one shared id; rapid presses collapse to a single action) |
| Activate       | The debounced callback queries `previousSelectors` or `nextSelectors` and calls `.click()` on the first match |

Key map when the matching preference is on:

| Direction | Letter | Numpad | Arrow |
| --------- | ------ | ------ | ----- |
| Previous  | `A`    | `4`    | Left  |
| Next      | `D`    | `6`    | Right |

No match logs a warning and is otherwise a no-op.

## Runtime configurations

Shown in the Configuration Menu (end-user preferences, not integration opts):

| Control                 | Key          | Default | Role                                            |
| ----------------------- | ------------ | ------- | ----------------------------------------------- |
| A / D keys              | `letterKeys` | `true`  | Enable `A` (prev) and `D` (next)                |
| Numpad 4 / 6 keys       | `numpadKeys` | `true`  | Enable Numpad `4` (prev) and Numpad `6` (next)  |
| Arrow Left / Right keys | `arrowKeys`  | `true`  | Enable Left Arrow (prev) and Right Arrow (next) |

Storage keys follow [Configuration - Storage key](./configuration.md#storage-key).

## Normalization

`normalizeKeyboardNavigationOpts(raw)` returns [`Normalized<KeyboardNavigationOpts>`](../utils/opts-normalization.md) (`src/supermonkey/modules/keyboard-navigation/keyboard-navigation-opts.ts`).

| Outcome    | When                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| **Reject** | Raw opts are not an object; `previousSelectors` or `nextSelectors` missing, not an array, or empty after trim. |
| **Repair** | Non-string entries inside a selector list are dropped; an all-invalid list still **rejects**.                  |

The loader constructs `KeyboardNavigation` with the cleaned `value`. Repair findings log as WARN (`Module options were repaired:`). A missing `value` logs FATAL for that instance.

## Authoring checklist

- Confirm prev/next controls exist and are clickable before wiring selectors.
- Order selectors from most specific to broadest fallback.
- Leave key-pair toggles to the user; defaults enable all three pairs.

## Full example

Standard `rel` navigation on a paginated site:

```ts
import { Integration } from "../metadata";

export const MYSITE_COM_INTEGRATION: Integration = {
  name: "mysite_com",
  matchedDomains: ["mysite.com"],
  modules: {
    keyboardNavigation: {
      module: "KeyboardNavigation",
      opts: {
        previousSelectors: ["a[rel='prev']", ".pager-prev"],
        nextSelectors: ["a[rel='next']", ".pager-next"],
      },
    },
  },
};
```

## See also

- [Configuration](./configuration.md)
- [Opts normalization](../utils/opts-normalization.md)
- [Integration DSL](../integrations/dsl.md)
- [TypeScript integration](../integrations/README.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
- [Modules overview](./README.md)
