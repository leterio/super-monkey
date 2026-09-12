# Integrations Menu

Open the Integrations Menu to see every known integration, which one is **active** on this tab, and actions to create or customize integrations.

**How to open:** Tampermonkey command **Open Integrations Menu** (works even when no site matches), or—while an integration is active—the **Open integrations** action in the [Configuration Menu](./configuration.md).

The Configuration Menu does not expose editor shortcuts. Everyday built-in use: [Using shipped integrations](../supermonkey/using-shipped.md).

## Panel layout

The panel lists every integration in the effective registry. When a tab has a loaded integration, that row is first; remaining rows are sorted by name. Each row shows:

| Badge / control | Meaning |
| --------------- | ------- |
| Provenance `builtin` | Shipped with Super Monkey. |
| Provenance `user` | Created or imported by you (storage only). |
| Provenance `override` | Your saved copy replaced a built-in with the same name. |
| Badge `active` | This integration is loaded on the current tab. |

Header controls:

| Control | Role |
| ------- | ---- |
| **Help** | Opens this documentation page in a new browser tab. |
| **Close** (`×`) | Closes the panel. |

Footer controls:

| Control | Role |
| ------- | ---- |
| **Create** | Opens the editor for a new integration. |
| **Import** | Opens a JSON or plain-text file into the editor after validation. |

## Row actions

| Provenance | Actions |
| ---------- | ------- |
| `builtin` | **Edit**, **Share** |
| `user` | **Edit**, **Share**, **Delete** |
| `override` | **Edit**, **Share**, **Reset** |

- **Edit** opens the [integration editor](../integrations/editor-ui.md) on that row. Saving an edited built-in writes a stored **override**.
- **Share** downloads the effective integration as `${name}-sm-integration.json` (use it to study a built-in’s JSON shape).
- **Reset** removes the override and restores the shipped built-in. **Delete** removes a user-only integration. Destructive actions confirm when module configuration keys must also be removed.

## Contributors

After feature instances load, the menu constructs as `{integration}::integrationsMenu`. That static module exposes the **Open integrations** Configuration action, which opens the same overlay as the Tampermonkey command.

The footer also includes a log-level picker (TRACE through FATAL). It calls `Logger.setLevel`, applies immediately, and persists Tampermonkey `logLevel`. See [Logger](../utils/logger.md) and [Runtime signals](../integrations/runtime-signals.md).

Implementation: `src/supermonkey/modules/integrations-menu/` (static module) and `src/supermonkey/integrations/menu/` (overlay). Effective registry and provenance: [TypeScript integration](../integrations/README.md#effective-registry).

## See also

- [Using shipped integrations](../supermonkey/using-shipped.md)
- [TypeScript integration](../integrations/README.md)
- [Integration editor](../integrations/editor-ui.md)
- [Runtime signals](../integrations/runtime-signals.md)
- [Configuration](./configuration.md)
- [Logger](../utils/logger.md)
- [Authoring a module](./authoring.md)
