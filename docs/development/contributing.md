# Contributing

Contributions keep Super Monkey focused, maintainable, and verifiable in the browser.

## Development principles

- **SOLID:** Give each module or class one responsibility, depend on abstractions, and preserve extension points where features evolve.
- **KISS:** Prefer the simplest solution that satisfies the current requirement.
- **DRY:** Move shared behavior into shared contracts or utilities.
- **YAGNI:** Build for current requirements.

A private helper used only by a class in the same file belongs on that class as a `private static` method. Exported utility functions in class-free modules are the exception.

## Definition of done

Complete these checks before reporting a change as finished:

1. Run `pnpm build` from the repository root. This command runs TypeScript checking and the production build.
2. Reload the target browser tab so the userscript runs again.
3. Confirm the expected bootstrap console lines, including `Starting SuperMonkey ...`. See [Debugging](./debugging.md) for levels, contexts, and failure signals.

## Documentation expectations

Rewrite affected documentation when a change materially updates usage, a public API, or observable behavior. Keep each page accurate for the current code and use English (USA).

When adding or moving a page, follow the [documentation site checklist](./documentation-site.md#adding-a-page).

Write and omit rules for documentation (idempotent pages, AGENTS vs `docs/` split, JSDoc gates) live in `AGENTS.md` at the repository root — follow that policy when editing docs; do not duplicate it here.

Agent invariants also live in `AGENTS.md`.
