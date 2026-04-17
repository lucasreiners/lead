# L.E.A.D. Agent Reference

> This file is read by the **Tester** agent for project-specific verification commands,
> and serves as the canonical reference for all L.E.A.D. agents.

## Project Verification

```bash
# Type check & build
bun run build

# Run all tests
bun test

# Expected: 134 tests across 25 files, 0 failures
```

---

## Agent Overview

L.E.A.D. provides **9 specialist agents** organized into two tiers:

| Agent | Key | Mode | Model Tier | Role |
|-------|-----|------|------------|------|
| **Tech Lead** | `tech-lead` | primary | Strategic (Opus) | Orchestrator — routes work to specialists |
| **Lead Developer** | `lead-dev` | primary | Strategic (Opus) | Plan executor — drives implementation with TodoWrite tracking |
| **Engineer** | `engineer` | subagent | Engineering (Sonnet) | Code implementer — writes features, fixes, tests |
| **Architect** | `architect` | subagent | Strategic (Opus) | Planner — creates structured plans in `.lead/` |
| **Code Analyst** | `code-analyst` | subagent | Engineering (Sonnet) | Codebase explorer — traces dependencies, identifies patterns |
| **Researcher** | `researcher` | subagent | Engineering (Sonnet) | External research — docs, libraries, APIs |
| **Reviewer** | `reviewer` | subagent | Engineering (Sonnet) | Quality gate — APPROVE or REJECT verdict |
| **Tester** | `tester` | subagent | Engineering (Sonnet) | Verification — runs tests, reports PASS or FAIL |
| **Guardian** | `guardian` | subagent | Engineering (Sonnet) | Security audit — OWASP checks, vulnerability scanning |

**Primary agents** are Tab-switchable in the UI. **Subagents** are delegated to by primary agents or invoked via `@mention`.

---

## Agent Details

### Tech Lead (default agent)

The entry point for all user requests. Analyzes intent, gathers context, and routes to the right specialist.

- **Can**: Read files, ask questions (via question tool), delegate to any agent
- **Cannot**: Write code, run bash commands, edit files
- **Key behaviors**:
  - Uses the **question tool** for all user-facing questions (never plain text)
  - Links work to tickets when applicable
  - Delegates planning to Architect, implementation to Engineer/Lead Dev
  - After Architect produces a plan, instructs user to run `/implement` — never starts implementation automatically

### Lead Developer

Executes approved plans step-by-step. The primary implementation driver.

- **Can**: Read, write, edit files, run bash, use TodoWrite
- **Cannot**: Second-guess approved plans
- **Key behaviors**:
  - **TodoWrite is mandatory** — seeds sidebar todos from plan's `## Progress` checkboxes before any work
  - Delegates code tasks to **Engineer** agents (can parallelize independent tasks)
  - Runs **Tester** after each task: implement → tester [PASS] → mark `- [x]` in plan + `completed` in todos
  - Max 3 fix cycles per task before moving on
  - On continuation (`/implement` resume): re-reads plan, rebuilds todo list from current state

### Engineer

Writes production-grade code. Delegated to by Lead Developer.

- **Can**: Read, write, edit files, run bash
- **Cannot**: Use TodoWrite (subagent limitation)
- **Key behaviors**:
  - Follows existing codebase patterns and conventions
  - Enterprise-grade error handling and TypeScript types
  - Verifies compilation and tests pass before finishing
  - No console.log or debug artifacts in production code

### Architect

Creates structured implementation plans. Never writes code.

- **Can**: Read files, write `.md` files in `.lead/` only
- **Cannot**: Write code files, edit source code, run bash
- **Plan locations**:
  - Ticket-linked: `.lead/<ticket>/plan.md`
  - Ad-hoc: `.lead/_adhoc/{slug}.md`
- **Plan structure** (mandatory):
  - `## TL;DR` — summary + estimated effort
  - `## Context` — original request + key findings
  - `## Objectives` — deliverables, definition of done, guardrails
  - `## Progress` — lightweight `- [ ]` checklist (only section with checkboxes, updated during execution)
  - `## TODOs` — detailed task descriptions with `**What**`, `**Files**`, `**Acceptance**`
  - `## Verification` — final verification checklist

### Code Analyst

Read-only codebase exploration. Traces dependencies, identifies patterns, surfaces insights.

- **Can**: Read files, use grep/glob
- **Cannot**: Write, edit, or run bash
- **Returns**: Structured summaries with file paths and line numbers

### Researcher

External documentation and library research.

- **Can**: Read files, fetch web content
- **Cannot**: Write, edit, or run bash
- **Returns**: Structured summaries with source citations, URLs, version numbers

### Reviewer

Code quality validation. Gives binary verdict.

- **Can**: Read files
- **Cannot**: Write, edit, or run bash
- **Verdict**: `[APPROVE]` or `[REJECT]` with evidence (file paths, line numbers)

### Tester

Runs verification commands and reports results. Never fixes code.

- **Can**: Read files, run bash (test/lint/build commands)
- **Cannot**: Write or edit files
- **Verdict**: `[PASS]` or `[FAIL]` — only reports FAIL for **new** issues, not pre-existing ones
- **Reads this file** (`AGENTS.md`) for project-specific verification commands

### Guardian

Security audit specialist.

- **Can**: Read files
- **Cannot**: Write, edit, or run bash
- **Verdict**: `[APPROVE]` or `[REJECT]` — fast-exits with APPROVE if no security-relevant changes
- **Framework**: OWASP Top 10, attack surface mapping, auth/authz verification, dependency security

---

## Workflow Patterns

### Planning → Implementation

```
User request → Tech Lead → Architect (creates plan)
                         → User reviews plan
                         → User runs /implement
                         → Lead Developer (executes plan, delegates to Engineers)
                         → Tester (verifies each task)
```

### Direct Implementation

```
User request → Tech Lead → Engineer (simple tasks)
                         → Tester (verification)
```

### User bypasses Tech Lead

```
Tab to Lead Developer → direct implementation work with TodoWrite tracking
```

---

## Key Conventions

- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`
- **State file**: `.lead/state.json` (gitignored, per-developer local state)
- **Plans**: `.lead/<ticket>/plan.md` (committed) or `.lead/_adhoc/{slug}.md` (gitignored)
- **TodoWrite**: Lead Developer seeds from plan checkboxes; marks `in_progress` before each task, `completed` after tester passes
- **Version**: Shown in Tech Lead display name (`Tech Lead · vX.Y.Z`)

---

## Editing Agent Prompts

Each agent has **two copies** of its prompt that must stay in sync:

1. **`src/agents/<name>/prompt.md`** — the source of truth, loaded at runtime via `readPromptMd(import.meta.url)`
2. **`INLINE_PROMPT`** in `src/agents/<name>/index.ts` — a hardcoded fallback used in the bundled `dist/index.js`

### Why two copies?

`readPromptMd()` resolves the `.md` file relative to the agent's `index.ts` using `import.meta.url`. This works in development (running from source), but in the published npm package only `dist/index.js` exists — there are no `.md` files. The `INLINE_PROMPT` string is the fallback for this case.

### The rule

**When you edit `prompt.md`, you MUST also update `INLINE_PROMPT` in the corresponding `index.ts`.**

If they drift out of sync, the agent behaves differently in dev vs production. This has caused bugs before.

### Special case: Tech Lead

The Tech Lead's prompt is **dynamically composed** in `src/agents/tech-lead/index.ts` — it injects the list of enabled agents into the prompt at build time. The `INLINE_PROMPT` there is a base template; the `createTechLeadAgent()` function appends agent-specific sections. Both the base template and `prompt.md` still need to stay in sync.
