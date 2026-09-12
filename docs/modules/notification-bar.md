# Notification Bar

## What you see on the page

When an integration is active, Super Monkey attaches a floating **icon row** on the page (corner position is configurable). Icons come from loaded modules (for example Additional Pages or Resources Downloader progress). Use the icons or Tampermonkey / Configuration Menu commands to open menus — you do not need the browser console for everyday use.

You can change corner position and icon size in the [Configuration Menu](./configuration.md#everyday-use) under the Notification Bar preferences for the active integration.

Everyday users can stop here. Authors: entry types and preferences below.

## Contributors

The Notification Bar is a static module that loads with every active integration. After feature instances load, `ModuleLoader` constructs `{integration}::notificationBar`. On `INTEGRATION_LOADED`, the bar attaches a closed shadow host to `document.body` and collects notification entries from loaded modules (`Module.notifications`), sorted by optional `weight`.

Source: `src/supermonkey/modules/notification-bar/`.

### Entries

`NotificationEntry` (`src/supermonkey/modules/notification-bar/entries/notification-entry.ts`) builds an icon from raw SVG. Optional `opts`:

| Field     | Role                                      |
| --------- | ----------------------------------------- |
| `css`     | Extra sheets adopted into the bar shadow. |
| `weight`  | Sort order (lower first).                 |
| `onClick` | Extra click handler on the icon.          |

Override `buildMenuContainer` to attach a popup. Icon click toggles the menu `open` class.

`ItemState` on the entry sets `data-state` on the icon and menu (`pending` clears the attribute).

### Progress menu

`ProgressMenuEntry` (`src/supermonkey/modules/notification-bar/entries/progress-menu/`) is a `NotificationEntry` with a titled panel of progress rows. [Additional Pages](./additional-pages.md) and [Resources Downloader](./resources-downloader.md) use it as a Notification Bar icon.

`mapItem(label, opts?)` appends a row and returns a handle: `setStatus`, `setProgress`, `setLabel`, `destroy`. Optional `onRetry` / `onCancel` show Retry / Cancel links (clicks are debounced). Optional `additionalButtons` on the entry opts add full-width buttons above the list.

### Preferences

The bar exposes two [configurations](./configuration.md) (keys under `{integration}::notificationBar::`):

| Key        | Role                                                                 |
| ---------- | -------------------------------------------------------------------- |
| `position` | Corner of the floating icon row: `top-left`, `top-right` (default), `bottom-left`, `bottom-right`. |
| `iconSize` | Menu labels Small / Medium / Large map to `32px`, `48px` (default), `64px`. Injects `--sm-nb-icon-size`. |

`integration.defaults` can supply specific overrides for this integration. The loader reads `defaults.notificationBar.position` when it is one of the four values and uses that as the bar's default position.

## See also

- [Using shipped integrations](../supermonkey/using-shipped.md)
- [Modules overview](./README.md)
- [Additional Pages](./additional-pages.md)
- [Configuration](./configuration.md)
- [Authoring a module](./authoring.md)
- [Integrations Menu](./integrations-menu.md)
