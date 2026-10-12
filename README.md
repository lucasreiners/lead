# L.E.A.D. - Lucas Engineering Automation & Delivery

Enterprise-grade [OpenCode](https://opencode.ai) plugin that turns a single AI agent into a **coordinated team of 10
specialists** — from requirements engineering and planning through implementation, testing, and review.

## Quick Start

1. **Add L.E.A.D.** to your OpenCode config (`~/.config/opencode/opencode.jsonc`):

   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": ["@lucasreiners/lead@latest"]
   }
   ```

2. **Restart OpenCode** — the plugin installs automatically from npm.

3. **Add to your project's `.gitignore`**:

   ```gitignore
   # L.E.A.D. — local state and ad-hoc plans (not for version control)
   .lead/state.json
   .lead/_adhoc/
   ```

   **Why**: `state.json` is per-developer local state (active plan, session ID, pause status) — sharing it across developers would cause conflicts. Ad-hoc plans are personal scratch work.

   Ticket-linked plans (`.lead/PROJ-123/plan.md`) **should** be committed — they are part of the feature, useful in PRs, and provide implementation traceability.

### OpenCode V2

L.E.A.D. 2.0.0 targets OpenCode V2 (`@opencode/plugin` 2.0.27 or a compatible release).
The default export provides `id: "lead"` and `setup(ctx)` for the native V2 runtime.
This is a breaking release: it requires OpenCode V2 and tracks task progress only in plan files.

Your existing `lead.jsonc`, plans, and `.lead/state.json` keep their format. V2 plugin
options can also contain L.E.A.D. configuration; they merge over the file-based settings:

```jsonc
{
  "plugins": [{
    "package": "@lucasreiners/lead@latest",
    "options": { "agents": { "engineer": { "model": "anthropic/claude-sonnet-4-5" } } }
  }]
}
```

V2-specific behavior:

- Agent IDs are stable slugs (`tech-lead`, `lead-dev`, `architect`, etc.); display names appear separately in the UI.
  Use the IDs for delegation and workflow definitions.
- Plan `## Progress` checkboxes are the sole source of task status. Execution, idle continuation,
  and compaction recovery read the plan from disk; a task stays unchecked until verification passes.
- V2 combines write, edit, and patch permissions. Planning agents can edit Markdown inside `.lead/`;
  the guard checks native permission resources, including multi-file patches.
- Agent tool preferences use native V2 names such as `shell`, `subagent`, and `read`.
- Idle continuation reminders are added to the next model request in the same session.

### Test a local checkout

Run `bun install` and `bun run build` in this repository, then add its directory to
the `plugins` array in your test project's `opencode.jsonc` (or your global config):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/lead"]
}
```

The repository's root `index.ts` forwards to `dist/index.js`, so OpenCode can load the
checkout directly as a local plugin directory. Relative paths also work and resolve from
the config file containing the entry. Replace any existing npm entry for L.E.A.D. with
this local path while testing.

After source changes, run `bun run build` again and reload OpenCode. If the shared service
still has the previous build loaded, run `opencode service restart`. Confirm `lead` is
active and the Tech Lead display name shows `2.0.0`.

Run `bun test` for unit and integration coverage (the portability tests also use Node),
or `bun run test:v2-package` to build, pack, install, and verify the package against a
local OpenCode V2 executable. The smoke test checks both the installed package and local
checkout, using its own temporary server, configuration, and data directories.

## The Big Picture

Instead of one AI agent, L.E.A.D. gives you a **team of 10 specialist agents** that work together — like a real
engineering team. The team is organized into two chains:

### 🎯 Functional Chain — driven by the **Product Owner**

Defines **what** to build. The Product Owner transforms stakeholder ideas into well-defined functional requirements through structured questioning and ticket system research.

**Two entry points:**

| Entry Point | When to Use |
|---|---|
| **Talk to the Product Owner** (Tab to PO agent) | Greenfield — describe a new feature idea, PO clarifies and drafts the requirement |
| `/read-existing-issue <ticket-id>` | Import an existing Jira/GitHub/Linear ticket, convert to local requirement template, then refine |

**The PO loop:** Clarify → Research (tickets & wiki) → Draft/Update → Present for review → repeat until approved → `/finalize-issue` to push to your ticket system.

The Product Owner uses **MCP servers** for Jira, GitHub Issues, Confluence, etc. — configure them in your project and the PO will use whatever's available.

### 🔧 Technical Chain — driven by the **Tech Lead**

Defines **how** to build it. The Tech Lead orchestrates planning, implementation, testing, and review.

```
User request → Tech Lead → Architect (creates plan)
                         → User reviews plan
                         → /implement → Lead Developer (executes, delegates to Engineers)
                                      → Tester (verifies each task)
                                      → Reviewer + Guardian (quality & security)
```

### Connecting the Chains

A typical workflow: PO finalizes a requirement → stakeholder hands it to the Tech Lead → Architect plans → `/implement` executes. The functional requirement becomes the input for the technical chain.

## How It Starts Up

When OpenCode loads, it finds L.E.A.D. in the plugin config and runs the entry point:

**`src/index.ts`** → This is "main()". It does 5 things in order:

1. **Load config** → reads `.opencode/lead.jsonc` (project) and `~/.config/opencode/lead.jsonc` (global) to get your
   customizations
2. **Load skills** → finds any skill files (reusable prompt snippets) from disk
3. **Create agents** → builds all 10 builtin agents + any custom ones you defined
4. **Create hooks** → sets up lifecycle hooks that monitor and enhance agent behavior
5. **Register extensions** → registers native domain transforms and hooks in `setup`

## The Agent Team

Each agent is defined in `src/agents/<name>/index.ts` with an accompanying `prompt.md`:

| Agent              | Role                                               | Can Write Code? | When It's Used                               |
|--------------------|----------------------------------------------------|-----------------|----------------------------------------------|
| **Tech Lead**      | Orchestrator — routes work to the right specialist | ❌ No            | Default agent, handles all incoming requests |
| **Product Owner**  | Requirements engineer — stakeholder ideas → functional requirements | ❌ No | Defining and finalizing feature requirements |
| **Lead Developer** | Executes plans step-by-step, delegates to engineers | ✅ Yes           | Primary agent, activated by `/implement` or Tab |
| **Engineer**       | Writes code, fixes bugs, implements features       | ✅ Yes           | Subagent, delegated to by Lead Developer     |
| **Architect**      | Creates implementation plans (`.md` files only)    | 📝 Only `.md`   | Complex features needing planning first      |
| **Code Analyst**   | Explores codebases, traces dependencies            | ❌ Read-only     | Understanding existing code                  |
| **Researcher**     | Looks up external docs, libraries, APIs            | ❌ Read-only     | "How does library X work?"                   |
| **Reviewer**       | Code review, gives APPROVE/REJECT verdict          | ❌ Read-only     | Quality validation                           |
| **Tester**         | Runs tests, linters, type checks — reports PASS/FAIL | ❌ Read + bash  | Verification after each implementation task  |
| **Guardian**       | Security audit, OWASP checks                       | ❌ Read-only     | Security-sensitive changes                   |

### How Agents Are Built

- Each agent starts as a **factory function** (`src/agents/agent-builder.ts`) that takes a model name and returns a
  config
- The factory has a `mode` property (`"primary"`, `"subagent"`, or `"all"`) that controls visibility in the UI
- `createBuiltinAgents()` in `src/agents/builtin-agents.ts` calls each factory, resolves the model, and applies any
  config overrides

### How Agents Get Registered

- V2's `v2-agents.ts` registers agents through `ctx.agent.transform`, using slug IDs and human-readable names.
- It uses native model references and permission rules and selects `tech-lead` as default when enabled.

### Architecture

```
                    User
                      |
                  Tech Lead          (orchestrator, read-only)
                 /    |    \
          Architect  Code Analyst  Researcher   (planning / exploration / research)
                |
             Lead Dev               (plan execution, full permissions)
               / \
        Engineer   Tester           (implement → verify cycle)
                |
          Reviewer + Guardian       (validation, read-only)
```

### Tool Permissions

| Agent         | shell | edit (write/patch) | read/glob/grep | web |
|---------------|-------|--------------------|----------------|-----|
| Tech Lead     | -     | -                  | yes            | yes |
| Product Owner | -     | .lead/**/*.md only | yes            | yes |
| Lead Dev      | yes   | yes                | yes            | yes |
| Engineer      | yes   | yes                | yes            | yes |
| Architect     | -     | .lead/**/*.md only | yes            | yes |
| Code Analyst  | -     | -                  | yes            | -   |
| Researcher    | -     | -                  | yes            | yes |
| Reviewer      | -     | -                  | yes            | -   |
| Tester        | yes   | -                  | yes            | -   |
| Guardian      | -     | -                  | yes            | -   |

## The Hooks System

Hooks are the plugin's nervous system — they intercept events at every stage of OpenCode's lifecycle. They're created in
`src/hooks/create-hooks.ts` and wired up in `src/runtime/opencode/v2-hooks.ts`.

### Native Runtime Hooks

| Hook                              | What Triggers It          | What L.E.A.D. Does                                            |
|-----------------------------------|---------------------------|---------------------------------------------------------------|
| `agent.transform`                | Registry rebuilds         | Registers agents and default selection                       |
| `session.hook("prompt")`         | Prompt admission          | Handles inline workflow controls                             |
| `session.hook("context")`        | Model request             | Adds pending continuation reminders                          |
| `event.subscribe` (`session.status`) | Session becomes idle   | Checks work/workflow progress for that session and location   |
| `command.transform`              | Command registry rebuilds | Registers all four slash commands and their executors         |
| `tool.hook("execute.before")`    | Agent calls a tool        | Guards planning agents and records metrics                    |
| `permission.hook("evaluate")`    | Edit permission evaluated | Restricts planning agents to `.lead/**/*.md`                  |
| `tool.hook("execute.after")`     | Tool completes            | Captures successful plan writes                              |
| `session.hook("compaction")`     | Context is summarized     | Recovers current plan progress and active workflow context    |

### Individual Hook Files (`src/hooks/`)

| Hook                           | File                            | Purpose                                                               |
|--------------------------------|---------------------------------|-----------------------------------------------------------------------|
| **start-implementation**       | `start-implementation-hook.ts`  | `/implement` command — find plan, create work state                   |
| **work-continuation**          | `work-continuation.ts`          | On idle, check active work, detect stale continuations, return prompt |
| **architect-md-only**          | `architect-md-only.ts`          | Guard: architect only writes `.md` in `.lead/`                        |
| **verification-reminder**      | `verification-reminder.ts`      | After edit/write/bash, remind agent to typecheck and test             |
| **compaction-recovery**        | `compaction-recovery.ts`        | After context compaction, re-inject active work summary               |
| **context-window-monitor**     | `context-window-monitor.ts`     | Warn at 75% and 90% context window usage                              |
| **write-existing-file-guard**  | `write-existing-file-guard.ts`  | Prevent overwriting files the agent hasn't read first                 |
| **keyword-detector**           | `keyword-detector.ts`           | Detect `/implement`, `/run-workflow`, workflow control keywords       |
| **rules-injector**             | `rules-injector.ts`             | Inject project rules from `.opencode/rules/*.md`                      |
| **first-message-variant**      | `first-message-variant.ts`      | Track sessions for first-message-only prompt injection                |
| **session-token-state**        | `session-token-state.ts`        | Track input/output tokens per session                                 |

## Commands

| Command | Description |
|---------|-------------|
| `/implement [ticket\|slug]` | Start or resume plan execution via Lead Developer |
| `/run-workflow [name] [prompt]` | Execute a multi-step workflow definition |
| `/read-existing-issue <ticket-id>` | Import existing ticket into local requirements folder for refinement |
| `/finalize-issue` | Push finalized requirement to ticket system (Jira, GitHub Issues, etc.) |

## The `/implement` Command Flow

This is the core workflow for executing plans:

```
1. User: /implement PROJ-123  (or /implement my-feature)
     ↓
2. start-implementation-hook.ts
   - Searches .lead/PROJ-123/plan.md, .lead/_adhoc/my-feature.md, .lead/plans/ (legacy)
   - Creates work state in .lead/state.json
   - Returns prompt: "You are now the Lead Developer..."
     ↓
3. Lead Developer agent starts working
   - Reads the plan file
   - Finds first unchecked - [ ] task in ## Progress
   - Reads its ## TODOs entry for What/Files/Acceptance details
   - Implements it (code, tests, etc.)
   - Keeps its checkbox unchecked until verification passes
     ↓
4. Lead Dev delegates to Tester agent
   - Tester reads AGENTS.md for project-specific commands
   - Runs typecheck → lint → tests
   - Returns [PASS] or [FAIL]
     ↓
5. If [FAIL]: leave unchecked, fix → back to step 4 (max 3 cycles, then report blocker)
   If [PASS]: marks task - [x], moves to next task
     ↓
6. Session goes idle → work-continuation.ts
   - Checks the plan on disk: are there remaining tasks for this session, and is work unpaused?
   - Yes → injects "Continue working on plan..."
   - Reminder is included in the next model request for this session
     ↓
7. All tasks checked → work complete
```

`## Progress` is the only task-status checklist; `## TODOs` remains the detailed implementation
section. Checkboxes in detailed descriptions or verification instructions do not count toward
progress when `## Progress` exists. Older plans without that section keep using their existing
task checklist in place.

After compaction, recovery reads current plan progress from disk and tells the executor to read
the plan before selecting the next unchecked task. Automatic recovery and continuation apply
only to registered sessions and skip paused work. Explicit `/implement` resumes a paused plan
and registers the invoking session.

### State Files

- `.lead/state.json` — tracks active plan, registered sessions, pause status, and stale-continuation metadata
- `.lead/<ticket>/plan.md` — ticket-linked plans (e.g. `.lead/PROJ-123/plan.md`)
- `.lead/_adhoc/*.md` — ad-hoc plans with no ticket reference

## The Workflow Engine

Beyond `/implement`, there's a full workflow system in `src/features/workflow/`:

- Workflow definitions live in `.opencode/workflows/*.jsonc`
- Each workflow has ordered **steps** with specific agents, prompts, and completion criteria
- The engine (`engine.ts`) is a state machine that advances through steps
- Steps can complete via: user confirmation, plan created, review verdict, etc.

### Workflow Flow

```
1. User: /run-workflow my-workflow "build new feature"
     ↓
2. handleRunWorkflow()
   - Discovers workflows in .opencode/workflows/*.jsonc
   - Validates schema, starts first step
   - Saves state to .lead/workflow/{id}.json
     ↓
3. Step agent executes (e.g., Architect creates plan)
     ↓
4. On session.idle → checkWorkflowContinuation()
   - Checks step completion (user_confirm, plan_created, etc.)
   - Marks step complete, advances to next
   - Switches agent, injects next step prompt
     ↓
5. Last step completes → workflow done
```

## Configuration

**`src/config/`** handles loading and merging config:

- `schema.ts` — Zod schemas define what's valid
- `loader.ts` — Loads global + project configs
- `merge.ts` — Deep merges them (project wins)

L.E.A.D. loads config from `.opencode/lead.jsonc` (project-level) and `~/.config/opencode/lead.jsonc` (global). Project
config takes precedence.

```jsonc
{
  // Override model for all agents
  "model": "anthropic/claude-sonnet-4-5",

  // Disable specific builtin agents
  "disabled_agents": ["guardian"],

  // Disable specific hooks
  "disabled_hooks": ["verification-reminder"],

  // Override model / variant for a specific builtin agent
  "agents": {
    "architect": {
      "model": "anthropic/claude-opus-4-1",
      "variant": "high"
    }
  },

  // Apply a model / variant to every agent in a category
  "categories": {
    "planning": {
      "variant": "high"
    }
  },

  // Add custom agents
  "custom_agents": {
    "my-agent": {
      "model": "anthropic/claude-sonnet-4-5",
      "variant": "high",
      "prompt": "You are a specialized agent for...",
      "mode": "subagent"
    }
  }
}
```

`variant` maps to OpenCode's agent model variant (e.g. reasoning effort). It is available at all three levels —
`agents.<name>`, `categories.<name>`, and `custom_agents.<name>` — and follows the same precedence as `model`: a
per-agent `variant` overrides a category-level one. It only applies when using the agent's configured model.

## Build Process

`script/build.ts` uses Bun's bundler:

- Entry: `src/index.ts` → Output: `dist/index.js` (ESM)
- Externals: `@opencode/plugin`, `zod`, `picocolors`
- OpenCode loads `dist/index.js` at startup

## Key Project Directories

```
your-project/
├── .opencode/
│   ├── lead.jsonc      ← project config
│   ├── rules/*.md         ← project rules injected into prompts
│   └── workflows/*.jsonc  ← workflow definitions
├── .lead/
│   ├── state.json         ← active work tracking
│   ├── PROJ-123/plan.md   ← ticket-linked plans
│   ├── _adhoc/*.md        ← ad-hoc plans (no ticket)
│   └── workflow/           ← workflow state
```

## Source File Organization

```
src/
├── index.ts                          ← MAIN ENTRY POINT
├── create-managers.ts                ← agent & manager factory
│
├── config/                           ← configuration layer
│   ├── schema.ts                       (zod validation)
│   ├── loader.ts                       (load from disk)
│   ├── merge.ts                        (deep merge logic)
│   └── continuation.ts                 (continuation defaults)
│
├── runtime/opencode/
│   ├── v2-setup.ts                   ← V2 initialization, options, skills
│   ├── v2-agents.ts                  ← native agent registration
│   ├── v2-hooks.ts                   ← V2 hooks, events, cleanup
│   └── v2-commands.ts                ← V2 command executors
│
├── agents/                           ← the agent team
│   ├── types.ts                        (AgentFactory, AgentMode)
│   ├── builtin-agents.ts              (factory registry + metadata)
│   ├── agent-builder.ts               (factory → AgentConfig)
│   ├── custom-agent-factory.ts        (custom agent builder)
│   ├── model-resolution.ts            (model selection logic)
│   ├── dynamic-prompt-builder.ts      (Tech Lead delegation table)
│   ├── prompt-loader.ts               (read prompt.md files)
│   ├── prompt-utils.ts                (normalize prompts)
│   ├── tech-lead/                     (orchestrator)
│   ├── product-owner/                 (requirements engineer)
│   ├── lead-dev/                      (plan executor)
│   ├── engineer/                      (implementer)
│   ├── architect/                     (planner)
│   ├── code-analyst/                  (explorer)
│   ├── researcher/                    (external research)
│   ├── reviewer/                      (quality review)
│   ├── tester/                        (verification — runs tests/lint)
│   └── guardian/                      (security audit)
│
├── managers/                         ← system managers
│   ├── background-manager.ts           (concurrent task tracking)
│   └── skill-mcp-manager.ts            (MCP server stub)
│
├── features/                         ← feature modules
│   ├── skill-loader/                   (API + FS skill discovery)
│   ├── work-state/                     (plan execution tracking)
│   └── workflow/                       (workflow state machine)
│
├── hooks/                            ← lifecycle hooks
│   ├── create-hooks.ts                 (hook factory)
│   ├── start-implementation-hook.ts    (/implement command)
│   ├── work-continuation.ts            (auto-continue work)
│   ├── architect-md-only.ts            (write guard)
│   ├── verification-reminder.ts        (test/typecheck reminders)
│   ├── compaction-recovery.ts          (context preservation)
│   ├── context-window-monitor.ts       (usage warnings)
│   ├── write-existing-file-guard.ts    (read-before-write)
│   ├── keyword-detector.ts             (command detection)
│   ├── rules-injector.ts               (project rules)
│   └── ...                             (additional lifecycle hooks)
│
├── shared/                           ← utilities
│   ├── log.ts                          (structured logging)
│   ├── agent-display-names.ts          (ID → display name)
│   ├── resolve-safe-path.ts            (path traversal protection)
│   └── version.ts                      (version constant)
│
├── domain/                           ← domain types (stubs)
│   └── policy/policy-result.ts         (allow/deny verdicts)
│
└── infrastructure/fs/
    └── config-fs-loader.ts             (JSONC file loading)
```

## License

MIT
