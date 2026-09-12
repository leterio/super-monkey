# Runtime signals for integrators

Use these signals when Save → reload did not produce the **active** badge or expected on-page markers. Everyday verify does not require DEBUG.

### Try without DEBUG first

1. Confirm **active** (and expected provenance) in the [Integrations Menu](../modules/integrations-menu.md).
2. Open DevTools **Elements** (usually **F12** or right-click → Inspect). Look for `data-sm-cm-*` on Content Manager matches and `data-sm-history` when History applies.
3. If those are missing, enable DEBUG below and use the symptom table.

Console lines include the Super Monkey name, log level, context, and message. See [Logger](../utils/logger.md) for the message shape and level thresholds.

## Enable DEBUG

1. Open the Tampermonkey menu and select **Open Integrations Menu**.
2. In the Integrations Menu footer, set the log-level picker to **DEBUG**.
3. Reload the page.

The picker applies the Logger threshold immediately and persists it. DEBUG includes INFO, WARN, ERROR, and FATAL output. Select **TRACE** when you also need detailed Content Manager payloads and DOM-oriented output.

## After Save - quick check

1. Select **Save** in the integration editor.
2. Reload the page.
3. Open the Tampermonkey menu and select **Open Integrations Menu**. Confirm that the integration has the **active** badge.
4. When the integration uses Content Manager and History, inspect matched entries in DevTools **Elements** (F12) and confirm `data-sm-cm-*` / `data-sm-history` attributes.
5. If badges or markers are missing, in the console find `Matched integration:` and check FATAL lines — see [Start from the symptom](#start-from-the-symptom).

## Start from the symptom

| Symptom                                   | Runtime signal                                                             | What to adjust in the editor                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Super Monkey does not activate            | `No integrations matched the current page. Feel free to create a new one!` | Confirm that **Matched domains** includes the current hostname and that exclusions do not reject it.                         |
| Invalid integration name                  | `Failed to init SuperMonkey.` (thrown cause: `Invalid integration name:`) | Fix `name` to one id segment (`[A-Za-z0-9_-]+`). Activation throws; bootstrap stops with no lifecycle events. |
| The wrong integration activates           | `Multiple integrations matched the hostname; using the first one.`         | Adjust **Matched domains** so only the intended integration matches.                                                         |
| Bootstrap stops before loading features   | `Initialization aborted on stage 1: No matching integration found.`        | Resolve integration matching first. This signal appears at TRACE.                                                            |
| A module is missing                       | `Failed to load module:` or `Unknown module:`                              | Check the instance's **Module key** and typed opts on the module page.                                                       |
| Module options load with repairs          | `Module options were repaired:`                                            | Review the reported findings and correct the module opts.                                                                    |
| Content Manager is inactive               | `Content manager not configured; Skipping content manager load.`           | Configure Content Manager groups, views, or listings when page discovery is required.                                        |
| Content Manager fails to load             | `Failed to load content manager`                                           | Fix rejected Content Manager opts (for example `Content manager options were rejected.`).                                    |
| Content Manager options load with repairs | `Content manager options were repaired:`                                   | Review the reported findings and correct the Content Manager fields.                                                         |
| Content Manager finds no entries          | No `Discovered` signal after reload                                        | Confirm selectors and ID sources against the live DOM.                                                                       |
| Override not applied                      | Provenance stays `builtin` after Edit/Save                                 | Confirm **Save** succeeded, reload the tab, and check the row shows `override` in the [Integrations Menu](../modules/integrations-menu.md). |

## Useful messages

### Integration discovery

| Level | Context           | Message                                                                    | Meaning                                                                              |
| ----- | ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| WARN  | IntegrationLoader | `No integrations matched the current page. Feel free to create a new one!` | No integration matches the hostname.                                                 |
| INFO  | IntegrationLoader | `Matched integration:`                                                     | The following value is the selected integration name.                                |
| WARN  | IntegrationLoader | `Multiple integrations matched the hostname; using the first one.`         | More than one integration matches; registry order determines the active integration. |
| ERROR | SuperMonkey | `Failed to init SuperMonkey.` (cause may be `Invalid integration name:`) | Matched entry `name` is not a valid id segment; `IntegrationLoader` throws and bootstrap aborts. |

### Bootstrap

| Level | Context     | Message                                       | Meaning                                                      |
| ----- | ----------- | --------------------------------------------- | ------------------------------------------------------------ |
| INFO  | SuperMonkey | `Starting SuperMonkey ...` (script full name) | Bootstrap began.                                             |
| DEBUG | SuperMonkey | `SuperMonkey initialized successfully`        | Bootstrap completed.                                         |
| TRACE | SuperMonkey | `Initialization aborted on stage 1: No matching integration found.` | Bootstrap stopped because discovery returned no integration. |

### Modules

| Level        | Context      | Message                         | Meaning                                                             |
| ------------ | ------------ | ------------------------------- | ------------------------------------------------------------------- |
| WARN         | ModuleLoader | `Module options were repaired:` | Normalization repaired module options; findings follow the message. |
| FATAL        | ModuleLoader | `Failed to load module:`        | The named module instance was skipped after a loading failure.      |
| FATAL detail | ModuleLoader | `Unknown module:`               | The configured module key is not registered.                        |

### Content Manager

| Level         | Context              | Message                                                          | Meaning                                                                      |
| ------------- | -------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| WARN          | ContentManagerLoader | `Content manager options were repaired:`                         | Normalization repaired Content Manager options; findings follow the message. |
| DEBUG         | ContentManagerLoader | `Content manager not configured; Skipping content manager load.` | The integration does not configure Content Manager.                          |
| FATAL | ContentManagerLoader | `Failed to load content manager`             | Content Manager opts rejected or construction failed; Content Manager stays off. |
| INFO or TRACE | ContentManager       | `Discovered` with `view entities`                                | A view scan found one or more entries.                                       |
| INFO or TRACE | ContentManager       | `Discovered` with `new listing entities`                         | A listing scan found one or more new entries.                                |

## Related

- [Integration editor](./editor-ui.md)
- [End-to-end tutorial](./tutorial.md)
- [Logger](../utils/logger.md)
- [Integrations Menu](../modules/integrations-menu.md)
- [Content Manager](../modules/content-manager.md)
- [Debugging](../development/debugging.md)
