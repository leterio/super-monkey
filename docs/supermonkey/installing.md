# Installing Super Monkey

Choose the path that matches how you use Super Monkey.

## Use Super Monkey

Tampermonkey is a browser extension that runs **userscripts** (small scripts such as Super Monkey) on the pages you visit.

1. Install **[Tampermonkey](https://www.tampermonkey.net/)** (or another userscript manager; Tampermonkey is the primary compatibility target).
2. Open the [latest GitHub Release](https://github.com/leterio/super-monkey/releases/latest).
3. Download the `.user.js` asset and open it so Tampermonkey offers to install the script (or use your manager’s install-from-file flow).
4. Confirm that Tampermonkey shows Super Monkey enabled.

Release notes on each GitHub Release describe what changed in that version.

### Use now

1. Open a site that a **shipped built-in** covers (see [Using shipped integrations](./using-shipped.md)).
2. Open the Tampermonkey menu and select **Open Integrations Menu**.
3. Confirm the matching row shows **Built-in** (`builtin`) and **Active on this tab** (`active`).
4. Optionally customize with **Edit** / **Share** / **Reset** — [Customize a matching integration](../integrations/editor-ui.md#customize-a-matching-integration).

To create your own integration instead, continue with the [Integration editor](../integrations/editor-ui.md) or the [end-to-end tutorial](../integrations/tutorial.md).

---

## For developers

Local build and `pnpm` workflows live here. Everyday install stops at **Use now** above.

### Build Super Monkey locally

From the repository root, run `pnpm install` and `pnpm build`. Open the `.user.js` file produced under `dist/` so Tampermonkey offers to install the script.

### Develop Super Monkey locally

Local development requires:

- Git
- A userscript manager (Tampermonkey recommended)
- Either Node.js, pnpm, and mkcert on the host or Docker with the Dev Containers extension

[Getting Started](../development/getting-started.md) covers cloning the repository, choosing a development environment, trusting the local HTTPS certificate, running the dev server, and installing the development userscript.
