---
name: doc-quality-visions
description: >-
  Orchestrates a qualitative Super Monkey docs review across four user personas
  (end user, editor UI, TypeScript author, maintainer) via parallel subagents.
  Use when the user asks for doc quality analysis, avaliação por visões,
  reorquestrar avaliação das docs, or names this skill.
disable-model-invocation: true
---

# Doc quality visions (Super Monkey)

Qualitative documentation review for Super Monkey using **four independent personas**. Analysis only unless the user asks to implement the backlog.

Skill text, prompts, and written reports are **English (USA)**. Match the user's chat language preference when summarizing in the conversation.

## Defaults (unless the user overrides)

| Knob | Default |
| ---- | ------- |
| Deliverable | Chat summary + files under `docs/superpowers/doc-quality-analysis/` (gitignored) |
| Depth | **Full journey** (follow links like a real user) |
| Priority | Vision **2 > 1 > 3 > 4** |
| Subagents | 4× `generalPurpose`, model `inherit`, **in parallel** |
| Edit docs / `src/` | **No** in analysis phase |
| Built-ins premise | Product **will** ship built-ins; evaluate docs for that happy path. Do **not** treat an empty `BuiltinIntegrations` array as product truth on cover/home. |
| Improve only | Tone, rhythm, links, sections — **do not degrade** coverage for other audiences |

Ask once (batch) only if deliverable or depth is unclear; otherwise apply defaults and run.

## Modes

| Mode | When | Output folder |
| ---- | ---- | ------------- |
| **first** | First run or reset | `…/phase-1-frozen/` (then mark frozen) |
| **reeval** | After doc changes (redo / re-orchestrate evaluation) | `…/phase-N-reeval/` (N = next) |
| **delta** | Compare another branch’s docs (e.g. `develop`) | `…/phase-N-*-delta/` — optional; no scores required if the user asked migrate-only |

Update `docs/superpowers/doc-quality-analysis/FROZEN.md` index. Never edit prior frozen phase files.

## Workflow

1. **Prep** — Create the phase directory. Spot-check that docs site entrypoints exist (`docs/_coverpage.md`, `docs/README.md`, root `README.md`).
2. **Prompts** — Build four Task prompts from [prompts.md](prompts.md). Substitute:
   - `{{REPO}}` → workspace root (absolute)
   - `{{OUT_DIR}}` → absolute path to this phase folder
   - `{{DEPTH_BLOCK}}` → depth instructions
   - Built-ins premise (always unless the user cancels it)
3. **Independence** — Subagents must **not** read prior phase reports under `docs/superpowers/` (except writing their own output file). No chat history of the project beyond the prompt.
4. **Launch** — Four `Task` calls in one message. Each agent **Write**s `vision-N-*.md` under `{{OUT_DIR}}` and returns the same content.
5. **Consolidate** — Parent writes `{{OUT_DIR}}/consolidated.md`:
   - Executive summary
   - Score table (and vs previous phase if reeval)
   - Conflicts between visions + resolution rule (priority 2>1>3>4)
   - Consensus themes
   - Prioritized backlog (`P0/P1/P2` or `R-*` / `S-*` for reevals)
   - Explicit **do not** (e.g. empty registry as cover truth)
6. **User summary** — Short table of averages + top backlog; link agents and `consolidated.md`. Do **not** implement unless asked.

## Persona map

| # | Persona | Entry | May read `src/`? |
| - | ------- | ----- | ---------------- |
| 1 | End user — use shipped built-ins | `docs/_coverpage.md` | No |
| 2 | Editor UI (CSS/HTML/JSON) — **primary** | `docs/_coverpage.md` | No |
| 3 | TypeScript integration author | root `README.md` → docs | Yes, only to verify docs vs API |
| 4 | Maintainer / core map | `README.md` + `AGENTS.md` when pointed | Yes, fidelity check |

## Output format (every vision)

English (USA) report with:

- **Journey followed**
- **What worked**
- **Friction / gaps** (cite page; cite `src/` if crossed)
- **Tone and pace**
- **Proposed improvements** (V2/V3/V4: top 5)
- **Score 1–5**: Clarity, Journey completeness, Discoverability, Confidence to act (+ average)
- **Verdict** (2–3 sentences)

## Depth variants

- **Full journey** (default) — follow links until the persona mission completes or stalls.
- **Spot-check** — entrypoint + install, tutorial, editor-ui, getting-started, using-shipped, lifecycle (as relevant).
- **Exhaustive** — read essentially all of `docs/` through the persona lens (expensive; only if requested).

## Hard constraints

- Visions 1–2: **never** open `src/`.
- Analysis phase: **no** doc/code edits; backlog only.
- Empty built-in registry in code → qualify by build in findings; do not recommend “document that nothing ships” as the product story.
- Follow `AGENTS.md` doc policy when later implementing (idempotent EN docs, no changelog narrative).

## Additional resources

- Persona prompt templates: [prompts.md](prompts.md)
