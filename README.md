<p align="center">
  <img src="docs/supermonkey.svg" alt="Super Monkey" width="200">
</p>

# Super Monkey

A collection of userscript features that complement compatible sites—history and repeat filtering, page customization, resource downloads, keyboard navigation, and more.

Built-in integrations cover common services; you can also create your own in the browser.

The name nods to classic userscript managers (Greasemonkey, Tampermonkey, ...). **Super** reflects a broader feature set than a single-purpose script.

**Requires** a userscript manager. **[Tampermonkey](https://www.tampermonkey.net/)** is the primary compatibility target. The script runs **inside the page** you browse.

[Documentation](https://leterio.github.io/super-monkey/#/) · [Issues](https://github.com/leterio/super-monkey/issues) · [License](LICENSE)

> Super Monkey is not affiliated with the sites it integrates with.

## Features

- **Integrations** — match domains and pages; ship built-ins or author your own (editor UI + TypeScript)
- **Content Manager** — find items and listings on the page; resolve stable ids for other features
- **History** — remember listed/viewed content; hide or decorate repeats in feeds
- **Custom CSS** — static and runtime styles per integration
- **Additional Pages** — fetch extra listing pages and merge entries into the live document
- **Resources Downloader** — map resources in listings and run downloads
- **Keyboard Navigation** — prev/next page controls via shortcuts
- **Configuration** — per-module preferences and an in-page Configuration Menu

Stack: TypeScript, Vite, [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).

## Install

1. Install a userscript manager (**[Tampermonkey](https://www.tampermonkey.net/)** recommended).
2. Open the [latest GitHub Release](https://github.com/leterio/super-monkey/releases/latest) and install the `.user.js` asset.

Details: [Installing Super Monkey](docs/supermonkey/installing.md). First run with shipped built-ins: [Using shipped integrations](docs/supermonkey/using-shipped.md). For local development (clone, `pnpm`, HTTPS, dev userscript), see [Getting Started](docs/development/getting-started.md). Maintainers cutting a version: [Releasing](docs/development/releasing.md).

## Built-in integrations

| Integration | Hosts (examples) |
| ----------- | ---------------- |
| `reddit_com` | `www.reddit.com`, `reddit.com` |

**GitHub Release** builds ship the built-ins listed in that version’s [release notes](https://github.com/leterio/super-monkey/releases/latest) and in the in-page [Integrations Menu](docs/modules/integrations-menu.md) (provenance **`builtin`**). A local clone lists whatever is registered in `BuiltinIntegrations` plus your stored integrations. First run: [Using shipped integrations](docs/supermonkey/using-shipped.md).

More sites work when you add an integration (built-in TypeScript or the browser editor). See [Integrations](docs/integrations/README.md) and the [integration editor](docs/integrations/editor-ui.md).

## Documentation

| Topic                                          | Link                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| Full docs index (purpose, motivation, modules) | [docs/README.md](docs/README.md)                       |
| Product overview                               | [Overview](docs/supermonkey/overview.md)               |
| Use what shipped                               | [Using shipped integrations](docs/supermonkey/using-shipped.md) |
| Local install & first run                      | [Getting Started](docs/development/getting-started.md) |
| Integration editor                             | [Editor UI](docs/integrations/editor-ui.md)            |
| Register a TypeScript built-in                 | [TypeScript integration](docs/integrations/README.md#register-a-built-in-integration) |
| TypeScript API index                           | [typescript-api.md](docs/integrations/typescript-api.md) |
| Contributing                                   | [Contributing](docs/development/contributing.md) · [AGENTS.md](AGENTS.md) |

## Usage & expectations

I use this script daily—especially to avoid seeing repeated content in feeds on social networks and news or article sites. The happy path is thoroughly exercised, including the integration editor UI. Individual sites may still behave poorly in edge cases.

If something goes wrong, please [open a GitHub issue](https://github.com/leterio/super-monkey/issues).

## Privacy

Super Monkey runs in the page context of matched sites. It can read the DOM and URL of those pages, and it stores preferences and history via the userscript manager’s storage APIs on your machine. It does not send your browsing data to a Super Monkey backend.

Review each integration’s match rules before enabling features on a site you care about.

## Contributing

Contributions that keep the script focused, maintainable, and verifiable in the browser are welcome.

- Development principles and definition of done: [Contributing](docs/development/contributing.md)
- Agent invariants for AI-assisted work in this repo: [AGENTS.md](AGENTS.md)
- Prefer opening an issue before large design changes

## AI-assisted development

This project is developed with the assistance of AI tools and agents. AI may be used to write, refactor, optimize, review, and improve parts of the codebase.

AI use is free and encouraged when approached consciously: review, understand, and validate AI-generated contributions before treating them as reliable. AI does not replace human judgment, code review, testing, security review, or responsibility for the resulting code.

## License

[MIT](LICENSE) © 2026 Vinícius Letério
