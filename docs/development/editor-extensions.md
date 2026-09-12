# Editor Extensions (VS Code / Cursor)

Recommended extensions for this project (kept in sync with `.vscode/extensions.json` and the Dev Container customizations):

| Extension                                                                                                         | ID                                      | Purpose                                                  |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| [Vite](https://marketplace.visualstudio.com/items?itemName=antfu.vite)                                            | `antfu.vite`                            | Vite / HMR integration                                   |
| [npm Intellisense](https://marketplace.visualstudio.com/items?itemName=christian-kohler.npm-intellisense)         | `christian-kohler.npm-intellisense`     | Autocomplete for npm module imports                      |
| [Debugger for Firefox](https://marketplace.visualstudio.com/items?itemName=firefox-devtools.vscode-firefox-debug) | `firefox-devtools.vscode-firefox-debug` | Firefox debug sessions (see [Debugging](./debugging.md)) |
| [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)                            | `esbenp.prettier-vscode`                | Code formatting                                          |

Install the recommendations from `.vscode/extensions.json` when working locally; opening the project in the [Dev Container](./dev-container.md) installs the same set through its editor customizations. The [Debugger for Firefox](https://marketplace.visualstudio.com/items?itemName=firefox-devtools.vscode-firefox-debug) extension is required for the launch configurations in the [Debugging workflow](./debugging.md).

For optional Dev Containers, also install [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) (`ms-vscode-remote.remote-containers`). See [Dev Container](./dev-container.md).

## See also

- [Getting Started](./getting-started.md)
- [Debugging](./debugging.md)
- [Dev Container](./dev-container.md)
