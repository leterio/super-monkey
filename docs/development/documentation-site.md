# Documentation Site

Super Monkey publishes the `docs/` directory as a Docsify site.

## Composition

- `index.html` configures Docsify, its theme, search, syntax highlighting, Mermaid, and shared navigation aliases.
- `.nojekyll` keeps the documentation files available without Jekyll processing.
- `_navbar.md` provides the primary navigation.
- `_sidebar.md` provides the complete page navigation.
- `_coverpage.md` provides the landing-page introduction and entry points.
- `README.md` is the documentation home page and complete page index.

Navigation files use root-absolute paths from the Docsify root. Links between documentation pages use relative paths.

## Adding a page

1. Create the Markdown file in the appropriate section directory.
2. Add the page to `_sidebar.md` with a root-absolute path.
3. Add the page to its section index.
4. Add the page to the appropriate table in `docs/README.md`.
5. Use relative paths for links between pages and confirm every target file exists.
6. When a public TypeScript symbol moves or gains narrative docs, update the [TypeScript API index](../integrations/typescript-api.md) and, if the architecture table changes, [Overview](../supermonkey/overview.md).
7. Keep `_coverpage.md` and the shipped-use happy path free of empty-registry framing; follow the write/omit rules in `AGENTS.md` (do not paste that policy here).

## Preview

Follow [Preview documentation](./getting-started.md#preview-documentation-optional) to serve the site locally.
