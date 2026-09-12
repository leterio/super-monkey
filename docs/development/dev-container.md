# Dev Container (optional)

A Dev Container is recommended so Node.js and pnpm run in a consistent environment without installing them on the host. The project already includes `.devcontainer/` - open the repository with Dev Containers and use **Reopen in Container**.

## Configuration

| Item              | Value                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base image        | `mcr.microsoft.com/devcontainers/typescript-node:4-24-trixie` (via `.devcontainer/Dockerfile`)                                                                                                                            |
| Workspace setup   | `.devcontainer/setup-dev.sh` (`postCreateCommand`: [mkcert](https://github.com/FiloSottile/mkcert) fallback, global `docsify-cli`, `pnpm install`)                                                                        |
| Package manager   | pnpm (Corepack; `PNPM_HOME/bin` on `PATH` in Dockerfile for global installs)                                                                                                                                              |
| Editor (optional) | vim (installed in Dockerfile)                                                                                                                                                                                             |
| Forwarded ports   | `5173` (Vite HTTPS), `3000` (Docsify docs) in `portsAttributes`                                                                                                                                                           |
| Auto-start        | VS Code tasks `pnpm:dev` and `docsify:serve` (`.vscode/tasks.json`, `runOn: folderOpen`; when `IN_DEV_CONTAINER=1`, free ports `5173`/`3000` before start; `docsify:serve` waits up to 3 minutes for `docsify` on `PATH`) |
| Extra mounts      | Host `~/.ssh` and `~/.gitconfig` (read-only) into the container                                                                                                                                                           |

Relevant keys in `.devcontainer/devcontainer.json`:

- `build` → `Dockerfile` with context `..`
- `remoteUser`: `node`
- `postCreateCommand`: `bash .devcontainer/setup-dev.sh`
- `forwardPorts` / `portsAttributes` for `5173` and `3000`
- `customizations.vscode.extensions` and settings (aligned with [Editor Extensions](./editor-extensions.md))

## How to use

1. Install [Docker](https://docs.docker.com/get-docker/) and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension (see [Editor Extensions](./editor-extensions.md)).
2. Open the repository and run **Dev Containers: Reopen in Container**.
3. `postCreateCommand` runs `.devcontainer/setup-dev.sh` (installs global `docsify-cli`, project dependencies, and generates certs with **mkcert** in `certs/` only when both files are missing). Existing certs are never overwritten.
4. On folder open, workspace tasks start `pnpm:dev` (HTTPS on port `5173`) and `docsify:serve` (docs on port `3000`). With `IN_DEV_CONTAINER=1`, each task frees its port before starting; `docsify:serve` waits until `docsify` is on `PATH` (up to 3 minutes) so it can run while `postCreateCommand` finishes. The editor may ask once to allow automatic tasks. You can also run tasks manually via **Terminal: Run Task**.

The workspace is mounted into the container, so source changes and the `certs/` folder are shared with the host. When mkcert creates certificates inside the container, follow [Getting Started - Trust the CA in the host browser](./getting-started.md#trust-the-ca-in-the-host-browser). You can also generate certificates on the host with mkcert and place them in `certs/` before opening the container.

## See also

- [Getting Started](./getting-started.md)
- [Editor Extensions](./editor-extensions.md)
