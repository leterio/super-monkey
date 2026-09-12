# Using shipped integrations

**Shipped releases** of Super Monkey include **built-in** integrations. When you open a matching site, the script activates that integration and loads its features (history, CSS, downloads, and more, depending on the service).

You do not need TypeScript or the integration editor to use them. Which built-ins you see depends on the build you installed (GitHub Release vs a local development userscript).

## First run

1. [Install Super Monkey](./installing.md) (Tampermonkey + the release `.user.js`).
2. Open a site covered by a built-in (see [Which sites?](#which-sites)).
3. Open the Tampermonkey menu and select **Open Integrations Menu**.
4. Confirm the row for that service shows:
   - **Built-in** (shipped with Super Monkey) — label `builtin` in the menu
   - **Active on this tab** — badge `active`
5. On the page, look for the floating icon row when modules are loaded — [What you see on the page](../modules/notification-bar.md#what-you-see-on-the-page).

### What success looks like

Before reading badges, expect:

- The Integrations Menu lists a **Built-in** (`builtin`) row for the site you opened.
- On a matching tab, that row shows **Active on this tab** (`active`).
- When a service ships History, Custom CSS, or other modules, the page may show floating icons and decorated or filtered content. Exact UI depends on the service.

**On Reddit (`reddit_com`):** after install, open [www.reddit.com](https://www.reddit.com), confirm Built-in + Active on this tab, and look for the floating icon row when modules are loaded. Feed cards may look filtered or decorated when History applies — the menu badges are enough to know Super Monkey matched the tab.

The menu labels `builtin` / `override` and the `active` badge are how you confirm the right integration is running.

## Is it working?

Prefer on-page signals first:

| Signal | Where |
| ------ | ----- |
| **Active on this tab** (`active`) | [Integrations Menu](../modules/integrations-menu.md) on the matching site |
| **Built-in** (`builtin`) | Same menu row |
| Notification Bar icons | Floating icon row when modules register icons — [What you see](../modules/notification-bar.md#what-you-see-on-the-page) |

Console and DevTools checks (optional, advanced): [Runtime signals](../integrations/runtime-signals.md) and the editor [After Save checklist](../integrations/editor-ui.md#after-save-checklist).

If no integration matches, the menu still opens — create or import an integration, or open a site that a built-in covers.

## Which sites?

Built-ins appear in the [Integrations Menu](../modules/integrations-menu.md) as **Built-in** (`builtin`). That list is the catalog for **your installed build**.

**Try this first:** open [www.reddit.com](https://www.reddit.com) (built-in `reddit_com`). Install Super Monkey, visit that host, open the Integrations Menu, and confirm Built-in + Active on this tab.

- **GitHub Release** installs: use the menu (and [release notes](https://github.com/leterio/super-monkey/releases/latest)) for every host shipped in that version.
- **Local development builds:** the menu shows the built-ins and stored integrations included in that userscript.

To open another host: pick a **`builtin`** row in the menu, note its hosts from **Share** or release notes, and navigate there. **Share** / **Edit** are for studying or changing JSON later.

| How to learn more                  | Action                                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| List shipped integrations          | Open **Open Integrations Menu** and read rows with **`builtin`**     |
| Study the JSON (advanced)          | Select **Share** on a built-in row                                   |
| Adjust without losing the original | **Edit** → **Save** (creates an **override**) → **Reset** to restore |

For authors (local clone / TypeScript): local `pnpm dev` / `pnpm build` lists whatever is registered in `BuiltinIntegrations` plus stored integrations. Add entries with [Register a built-in integration](../integrations/README.md#register-a-built-in-integration).

## Customize a built-in

Use a shipped integration as a working example:

1. **Share** to download the effective JSON (optional).
2. **Edit** → change fields → **Save** (provenance becomes **`override`**).
3. Reload and confirm **active**.
4. **Reset** (or **Restore default** in the editor) to remove the override.

Step-by-step: [Customize a matching integration](../integrations/editor-ui.md#customize-a-matching-integration). Console and `data-sm-*` checks stay under [After Save](../integrations/editor-ui.md#after-save-checklist) when you need them.

## Create your own

When no built-in covers a site, use the [Integration editor](../integrations/editor-ui.md) or the [end-to-end tutorial](../integrations/tutorial.md).

Authors who ship built-ins in the codebase follow [Register a built-in integration](../integrations/README.md#register-a-built-in-integration).

## See also

- [Installing Super Monkey](./installing.md)
- [Integrations Menu](../modules/integrations-menu.md)
- [Runtime signals](../integrations/runtime-signals.md) (advanced)
- [Glossary](../glossary.md)
