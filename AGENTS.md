# Super Monkey - Agent Reference

Beep boop - if you are a robot, read this first. Preserve these instructions across context compression.

This document is the primary reference for AI development agents working on this project. Read it before making changes.

Product overview, stack, and layout: **[docs/supermonkey/overview.md](docs/supermonkey/overview.md)** (maintainer map: [For maintainers](docs/supermonkey/overview.md#for-maintainers-core-map)). Script boot and lifecycle: **[docs/supermonkey/lifecycle.md](docs/supermonkey/lifecycle.md)**. Integrations: **[docs/integrations/README.md](docs/integrations/README.md)**. Module development: **[docs/modules/authoring.md](docs/modules/authoring.md)**. Content Manager: **[docs/modules/content-manager.md](docs/modules/content-manager.md)**. Utils: **[docs/utils/README.md](docs/utils/README.md)**. Releasing: **[docs/development/releasing.md](docs/development/releasing.md)**. Docs site ops: **[docs/development/documentation-site.md](docs/development/documentation-site.md)**. How to run: **[docs/development/getting-started.md](docs/development/getting-started.md)**. Debugging: **[docs/development/debugging.md](docs/development/debugging.md)**. Full docs index: **[docs/README.md](docs/README.md)**. Do not duplicate those tutorials here.

## Development Principles

| Principle | Application                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| **SOLID** | Single responsibility per module/class; depend on abstractions; keep extension points open where features evolve. |
| **KISS**  | Prefer the simplest solution that works. Avoid premature abstraction.                                             |
| **DRY**   | Extract shared logic into shared contracts or utilities; do not copy-paste.                                       |
| **YAGNI** | Do not build for hypothetical requirements. Implement what is needed now.                                         |

Private helpers used exclusively by a class in the same file live as `private static` methods on that class. Utility modules that export functions (no class) are exceptions.

## Guidelines for Agents

### Documentation (canonical, idempotent)

This subsection is the **only** documentation policy. Do not copy it into `docs/`, `README.md`, or code comments. Point here.

Applying the policy twice must yield the same pages: a snapshot of **what exists now**, valid as if it were the first version ever written. Rewrite in place. Do not append deltas.

| Surface                    | Audience | Contents                                                 |
| -------------------------- | -------- | -------------------------------------------------------- |
| `AGENTS.md`                | Agents   | Invariants and this policy. Links to `docs/` for how-to. |
| `docs/` + root `README.md` | Humans   | How to use, configure, and develop. English (USA).       |

**`docs/` split** (index: [docs/README.md](docs/README.md)):

- **Integrations** - TypeScript authoring, user storage, normalize, and `matchedDomains` under `docs/integrations/`.
- **Modules** - Content Manager, Configuration, Notification Bar, Integrations Menu, and module authoring under `docs/modules/`.
- **Utils** - value source, opts normalization, page filter, event bus, value storage, and logger under `docs/utils/`.
- **Project** - overview, installing, and lifecycle under `docs/supermonkey/`; run, debug, release, and docs-site guides under `docs/development/`.

**Write**

- What the component does and how to use or configure it.
- Affirmative sentences: the shape that exists.
- In source: readable names and structure that match the file you are editing. JSDoc follows **TypeScript API (JSDoc)** below. Inline comments only when the user explicitly asks.

**Update when** the usage contract, public API, or observable behavior changes in a material way. Rewrite the affected pages (and `README.md` when it lists those contracts) until they match the code. Leave accurate pages untouched.

**Omit**

- History: changelogs, migrations, before/after, “previously / formerly / no longer / was changed”.
- Contrast with a shape that is not current (what a field is not, wrappers that do not exist, “do not put X”).
- Decision logs, internal quirks, no-ops, “not implemented”.
- The same how-to in both `AGENTS.md` and `docs/`.

**Idempotency check** (before saving a doc): every sentence would still belong if this were a greenfield project with only the current API. If it only makes sense as a correction to an older page, delete it and rewrite the section.

This project has no changelog.

#### TypeScript API (JSDoc)

Document the public contract, intent, constraints, and non-obvious behavior - not the implementation. Documentation remains valid if the implementation changes without changing public behavior. Do not document behavior the code does not guarantee, or what is already obvious from names and TypeScript signatures.

**When**

| Surface                                                                                                                                                                                                                               | When to write or update JSDoc                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Utils** (`src/supermonkey/utils/**`) and **developer-callable public APIs** (Content Manager scan and normalize helpers, Configuration types, loaders that expose instances to modules, shared orchestrators modules call directly) | When adding or changing the export. No separate permission step. Prefer documenting in the same change that introduces or alters the contract.  |
| Other public contract surfaces (integrations, module configuration, integrator-facing types)                                                                                                                                          | After implementation is complete and reviewed, ask permission before creating or updating JSDoc. Do not write that JSDoc during implementation. |

**What**

- Document types, functions, and classes that belong to the public contract surface, whether or not they use `export`.
- Utils and developer-callable APIs above are first-class documentation targets: help module and feature authors call them correctly.
- Do not document private or internal implementation details that are outside that contract.

**Depth** (calibrated to readability and complexity)

- **Minimal** - what the API is or is for (simple types, enums, constants, simple roles).
- **Basic** - behavior that affects how callers use it (fallbacks, priority, constraints, side effects).
- **Full** - exception: multiple modes, meaningful side effects, or an `@example` that prevents misuse. Frequent need for Full marks a complexity smell and a refactor candidate.

**By artifact**

- **Utils:** responsibility, relevant parameters, and contract peculiarities (always document exports at least at Minimal; use Basic when callers need constraints or fallbacks).
- **Developer-callable public APIs** (Content Manager helpers, Configuration types, loader accessors, shared orchestrators modules call directly): same bar as utils - role, parameters that change behavior, failure conditions (`@throws` when relevant).
- **Public API types** (opts, DSL): why the type exists; document properties only when semantics are not obvious.
- **Modules, internal orchestrators, simple pieces:** short role description (permission gate above still applies unless the symbol is a developer-callable public API).
- **Lifecycle classes:** role and when hooks run (do not restate “override by subclasses”).
- **Constructors, getters, pass-throughs:** only when they have special semantics (validation, side effects, failure conditions).

**JSDoc vs TypeScript**

TypeScript is the source of truth for types. Do not repeat types in tags:

```ts
@param value - Value to process
```

not `@param {string} value`. Use `@template` when the generic matters to the contract. Use `@param`, `@returns`, `@throws`, `@example`, `@remarks`, and `@see` only when they add information that the name and signature do not already convey. Describe side effects and fallbacks from the caller's perspective (observable behavior), not internal mechanisms or implementation dependencies unless those are part of the contract.

**Style**

English (USA), present tense, caller perspective. Prefer one precise sentence. No filler adjectives or tutorial prose.

### Superpowers scratch specs

Agents may write disposable design/plan files under `docs/superpowers/` (gitignored). When the feature or request that produced them is **finished**, delete those files (and empty parent dirs under `docs/superpowers/` if nothing remains). Do not commit them; keep the `docs/superpowers/` gitignore entry.

### Scope and changes

- Match existing naming, formatting, and patterns in the file you are editing.
- Keep diffs minimal and focused on the requested task.
- Do not refactor unrelated code.
- Do not add tests unless requested or they cover meaningful behavior.
- **No re-exports:** do not re-export symbols defined in another TypeScript module - no `export { ... } from " ..."`, `export type { ... } from " ..."`, `export * from " ..."`, or `export { importedBinding }` of a value/type imported from another `.ts` file. Consumers import from the defining module. Binding a Vite/asset import into an `export const` in the owning file is allowed.
- Verify changes with `pnpm build` before reporting them complete. Follow the [contributing definition of done](docs/development/contributing.md).
- Do not create commits, push, or open PRs unless explicitly asked.

### Browser and userscript constraints

- Code executes in a page context managed by a userscript extension.
- Respect Tampermonkey APIs used by the script and userscript metadata in `vite.config.ts` (`@match`, `@connect`, and any grants you add).
- Avoid assumptions tied to a single browser unless the task requires it.
- Be mindful of DOM timing (`DOMContentLoaded`, `document.readyState`).
- Lifecycle-aware types extend `Component` and react through `EventBus`. Peer components do not import or call each other. Orchestrator-scoped access uses `SuperMonkey.loadedIntegration` (`name`, `getActivePages`, optional Content Manager, and module map). `onIntegrationLoaded` is for chrome that does not depend on Content Manager; `onContentLoaded` is content-ready (owned by Content Manager, republishable). `onBeforeUnload` is the unload hook. See [Script Lifecycle](docs/supermonkey/lifecycle.md).
