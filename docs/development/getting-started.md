# Getting Started

Run the Super Monkey development userscript locally.

## Get the repository

Install Git, then clone the canonical repository:

```bash
git clone https://github.com/leterio/super-monkey.git super-monkey
cd super-monkey
```

**Checkpoint:** the current directory contains `package.json`, `vite.config.ts`, and `docs/`.

## Choose a development environment

Install a userscript manager in the host browser. Tampermonkey is the primary target.

Choose one environment:

- **Native:** install Node.js (LTS recommended), pnpm, and [mkcert](https://github.com/FiloSottile/mkcert#installation) on the host.
- **Dev Container:** install Docker and the Dev Containers extension, then open the repository and run **Dev Containers: Reopen in Container**. The container installs pnpm dependencies and creates local certificates during setup. See [Dev Container](./dev-container.md).

Optional tools:

- [Editor extensions](./editor-extensions.md)
- [Debugging with Firefox](./debugging.md)

## Install dependencies

Run this command from the repository root in the native environment:

```bash
pnpm install
```

The Dev Container setup runs the same installation automatically.

**Checkpoint:** `pnpm --version` prints a version and the repository contains `node_modules/`.

## Configure local HTTPS certificates

The Vite dev server uses HTTPS and reads `certs/key.pem` and `certs/cert.pem`.

### Create the local CA

Run this command in the environment that generates the project certificates:

```bash
mkcert -install
```

The Dev Container setup runs this command when it creates a local CA.

### Trust the CA in the host browser

Locate the CA certificate:

```bash
mkcert -CAROOT
```

The certificate is `rootCA.pem` inside the printed directory. Dev Container setup also links it at `certs/rootCA.pem`.

Import `rootCA.pem` as a trusted root certificate where the host browser reads certificates:

- **Linux:** copy it to `/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`, or use the desktop certificate manager.
- **macOS:** open it in Keychain Access and set trust to **Always Trust**.
- **Windows:** import it with _Manage user certificates_ under _Trusted Root Certification Authorities_.
- **Firefox with its own certificate store:** import it under _Authorities_ in Certificate Manager.

### Generate project certificates

Dev Container setup generates the files automatically. In a native environment, run:

```bash
mkdir -p certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 127.0.0.1 ::1
```

**Checkpoint:** `certs/key.pem` and `certs/cert.pem` exist.

## Run the dev server

```bash
pnpm dev
```

Vite prints the local HTTPS URL. The default is `https://localhost:5173`; when that port is busy, use the port shown in the terminal.

Open the printed URL in the host browser.

**Checkpoint:** the vite-plugin-monkey page opens over HTTPS without a certificate warning.

## Install in Tampermonkey

Open the development userscript URL:

```text
https://localhost:<port>/__vite-plugin-monkey.install.user.js
```

Replace `<port>` with the port printed by Vite. The dev server root also presents a link to this userscript.

Accept the Tampermonkey installation prompt.

**Checkpoint:** the Tampermonkey dashboard shows **server:SuperMonkey** enabled.

## Verify the success ladder

Super Monkey has three observable states:

1. **Installed:** the Tampermonkey dashboard shows **server:SuperMonkey** enabled.
2. **Loaded on the page:** on an HTTP(S) page covered by the current userscript metadata, the top-frame console shows `Starting SuperMonkey ...`.
3. **Iframes stay silent:** nested frames do not run the script (`@noframes` plus the top-frame check in `src/main.ts`).

### Where integrations come from

The shipped built-in registry for a given build lives in `BuiltinIntegrations` (`src/supermonkey/integrations/builtin/builtin.ts`). Release userscripts include the built-ins registered for that version; a local clone lists whatever you have appended there. When no integration in the effective registry matches the hostname, bootstrap stops after discovery and logs that no integrations matched — lifecycle events are not published.

Userscript metadata in `vite.config.ts` controls **injection** into a page (`@match`). Integration `matchedDomains` control **which** integration activates. To add a built-in, follow [Register a built-in integration](../integrations/README.md#register-a-built-in-integration). User-stored integrations live under Tampermonkey key `superMonkeyUserIntegrations` — [TypeScript integration](../integrations/README.md). End-user discovery: [Using shipped integrations](../supermonkey/using-shipped.md).

## Development reload

1. Vite and vite-plugin-monkey may refresh the injected userscript bundle when source files change.
2. The in-page `SuperMonkey` instance is initialized once per tab. Reload the tab after code changes to run bootstrap again.

For boot order, isolation, and lifecycle events, see [Lifecycle](../supermonkey/lifecycle.md).

## Preview documentation (optional)

The [Dev Container](./dev-container.md) installs `docsify-cli` globally. In a native environment, install it yourself (for example `npm install -g docsify-cli@5`), then from the repository root:

```bash
docsify serve docs
```

On folder open, the workspace task `docsify:serve` starts the same command at `http://localhost:3000`. You can also run it with **Terminal: Run Task**.

## Other commands

```bash
pnpm build           # Type-check + production build
pnpm preview         # Preview production build
pnpm clean           # Remove dist/
```

`pnpm clean` removes `dist/`. Shipping a GitHub Release is automated when `develop` merges into `main`. See [Releasing](./releasing.md).

**Next:** [Register a built-in integration](../integrations/README.md#register-a-built-in-integration) to ship a coded integration in the local clone. Continue with [Contributing](./contributing.md) for the development definition of done and documentation expectations.
