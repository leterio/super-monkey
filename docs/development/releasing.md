# Releasing

Publish Super Monkey as a GitHub Release with a production userscript asset. Release notes on each GitHub Release describe what changed in that version.

Public install links and userscript metadata use [leterio/super-monkey](https://github.com/leterio/super-monkey).

## Prerequisites

- A pull request from `develop` into `main` that is ready to ship
- Push access for maintainers who merge that PR
- Branch protection on `main` allows GitHub Actions (`github-actions[bot]` / `GITHUB_TOKEN`) to push commits and tags; otherwise the Release workflow fails and no draft is created

## Ship a version

1. Open a pull request with base `main` and head `develop`.
2. Optionally add a bump label on the PR:
   - `release:major`
   - `release:minor`
   - `release:patch`
   - If more than one of these labels is present, the highest wins (`major` > `minor` > `patch`).
   - If none are present, the bump is `patch`.
3. Merge the pull request.
4. The **Release** workflow (`.github/workflows/release.yml`) runs on the merge commit: Node.js 22 and pnpm 12, bumps `package.json` with the matching `pnpm version:*` script (production build via the `version` hook), pushes the version commit plus an annotated `vX.Y.Z` tag to `main`, and opens a **draft** GitHub Release with generated notes and the `dist/*.user.js` asset.
5. Open the draft Release on GitHub, edit the notes, then **Publish**.
6. Confirm the published asset installs in Tampermonkey and that the userscript header shows the new version.

Only merges from `develop` into `main` start this path. Merges from other branches into `main` do not bump, tag, or open a Release.

### Built-ins checklist (before Publish)

Confirm what this version ships as **`builtin`**:

1. Review `BuiltinIntegrations` in `src/supermonkey/integrations/builtin/builtin.ts` — empty is allowed only when intentional; otherwise every entry you expect in the Release is listed.
2. Smoke-test: install the draft `.user.js`, open **Open Integrations Menu**, confirm each shipped name shows provenance **`builtin`**.
3. On at least one matched host for a shipped built-in, confirm the **`active`** badge.
4. List friendly names and example hosts in the Release notes (and keep [Using shipped integrations](../supermonkey/using-shipped.md) / root README tables aligned when the catalog changes).

Install instructions for end users: [Installing Super Monkey](../supermonkey/installing.md).
