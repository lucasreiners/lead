# L.E.A.D. - Lucas Engineering Automation & Delivery

Enterprise-grade [OpenCode](https://opencode.ai) plugin that turns a single AI agent into a **coordinated team of 10
specialists** — from requirements engineering and planning through implementation, testing, and review.

## Quick Start

1. **Add L.E.A.D.** to your OpenCode config (`~/.config/opencode/opencode.jsonc`):

   ```jsonc
   {
     "plugin": ["@lucasreiners/lead@latest"]
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
4. **Create hooks** → sets up ~15 lifecycle hooks that monitor and enhance agent behavior
5. **Return the plugin interface** → hands everything to OpenCode as a set of hooks

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

- The `ConfigHandler` (`src/managers/config-handler.ts`) takes all built agents and writes them into OpenCode's config
  object
- Agent keys use display names ("Tech Lead" not "tech-lead") for cleaner UI
- Sets `config.default_agent = "Tech Lead"` so it appears first

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

| Agent      | bash | edit | write    | read/glob/grep | web |
|------------|------|------|----------|----------------|-----|
| Tech Lead  | -    | -    | -        | yes            | yes |
| Product Owner | -    | -    | .md only | yes            | yes |
| Lead Dev   | yes  | yes  | yes      | yes            | yes |
| Engineer   | yes  | yes  | yes      | yes            | yes |
| Architect  | -    | -    | .md only | yes            | yes |
| Code Analyst | -    | -    | -        | yes            | -   |
| Researcher | -    | -    | -        | yes            | yes |
| Reviewer   | -    | -    | -        | yes            | -   |
| Tester     | yes  | -    | -        | yes            | -   |
| Guardian   | -    | -    | -        | yes            | -   |

## The Hooks System

Hooks are the plugin's nervous system — they intercept events at every stage of OpenCode's lifecycle. They're created in
`src/hooks/create-hooks.ts` and wired up in `src/runtime/opencode/plugin-adapter.ts`.

### Plugin Adapter Hooks

| Hook                              | What Triggers It          | What L.E.A.D. Does                                            |
|-----------------------------------|---------------------------|---------------------------------------------------------------|
| `config`                          | Plugin loads              | Registers all agents                                          |
| `chat.message`                    | Every message sent        | Tracks active agent, injects any pending continuation prompts |
| `event` (session.idle)            | Agent finishes responding | Checks if there's more plan work to do → auto-continues       |
| `command.execute.before`          | User runs a `/command`    | Handles `/implement` and `/run-workflow`                      |
| `tool.execute.before`             | Agent calls a tool        | Guards architect (only `.md`), captures todo writes           |
| `tool.execute.after`              | Tool finishes             | Reminds agent to verify (typecheck, test)                     |
| `tool.definition`                 | Tool list requested       | Overrides todowrite description                               |
| `experimental.session.compacting` | Context window compressed | Preserves work state & todos through compaction               |

### Individual Hook Files (`src/hooks/`)

| Hook                           | File                            | Purpose                                                               |
|--------------------------------|---------------------------------|-----------------------------------------------------------------------|
| **start-implementation**       | `start-implementation-hook.ts`  | `/implement` command — find plan, create work state                   |
| **work-continuation**          | `work-continuation.ts`          | On idle, check active work, detect stale continuations, return prompt |
| **architect-md-only**          | `architect-md-only.ts`          | Guard: architect only writes `.md` in `.lead/`                        |
| **todo-writer**                | `todo-writer.ts`                | Capture todowrite operations for state tracking                       |
| **verification-reminder**      | `verification-reminder.ts`      | After edit/write/bash, remind agent to typecheck and test             |
| **compaction-recovery**        | `compaction-recovery.ts`        | After context compaction, re-inject active work summary               |
| **compaction-todo-preserver**  | `compaction-todo-preserver.ts`  | Save/restore todo state through compaction                            |
| **context-window-monitor**     | `context-window-monitor.ts`     | Warn at 75% and 90% context window usage                              |
| **write-existing-file-guard**  | `write-existing-file-guard.ts`  | Prevent overwriting files the agent hasn't read first                 |
| **keyword-detector**           | `keyword-detector.ts`           | Detect `/implement`, `/run-workflow`, workflow control keywords       |
| **rules-injector**             | `rules-injector.ts`             | Inject project rules from `.opencode/rules/*.md`                      |
| **first-message-variant**      | `first-message-variant.ts`      | Track sessions for first-message-only prompt injection                |
| **todo-continuation-enforcer** | `todo-continuation-enforcer.ts` | Detect stale in-progress todos, prompt to complete/cancel             |
| **todo-description-override**  | `todo-description-override.ts`  | Override todowrite description with executor discipline rules         |
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
   - Returns prompt: "You are now the Executor..."
     ↓
3. Lead Developer agent starts working
   - Reads the plan file
   - Finds first unchecked - [ ] task
   - Implements it (code, tests, etc.)
     ↓
4. Lead Dev delegates to Tester agent
   - Tester reads AGENTS.md for project-specific commands
   - Runs typecheck → lint → tests
   - Returns [PASS] or [FAIL]
     ↓
5. If [FAIL]: Lead Dev fixes issues → back to step 4 (max 3 cycles)
   If [PASS]: marks task - [x], moves to next task
     ↓
6. Session goes idle → work-continuation.ts
   - Checks: are there remaining tasks?
   - Yes → injects "Continue working on plan..."
   - Agent resumes automatically
     ↓
7. All tasks checked → work complete
```

### State Files

- `.lead/state.json` — tracks active plan, session, pause status
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

  // Add custom agents
  "custom_agents": {
    "my-agent": {
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "You are a specialized agent for...",
      "mode": "subagent"
    }
  }
}
```

## Build Process

`script/build.ts` uses Bun's bundler:

- Entry: `src/index.ts` → Output: `dist/index.js` (ESM)
- Externals: `@opencode-ai/plugin`, `@opencode-ai/sdk`, `zod`, `picocolors`
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
├── create-tools.ts                   ← skill loading orchestration
├── create-managers.ts                ← agent & manager factory
│
├── config/                           ← configuration layer
│   ├── schema.ts                       (zod validation)
│   ├── loader.ts                       (load from disk)
│   ├── merge.ts                        (deep merge logic)
│   └── continuation.ts                 (continuation defaults)
│
├── plugin/                           ← plugin interface wrapper
│   ├── plugin-interface.ts             (adapter → Hooks)
│   └── types.ts                        (PluginContext, LeadHooks)
│
├── runtime/opencode/
│   └── plugin-adapter.ts            ← ALL HOOK IMPLEMENTATIONS
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
│   ├── config-handler.ts               (register agents into OpenCode)
│   ├── background-manager.ts           (concurrent task tracking)
│   └── skill-mcp-manager.ts            (MCP server stub)
│
├── features/                         ← feature modules
│   ├── skill-loader/                   (API + FS skill discovery)
│   ├── work-state/                     (plan execution tracking)
│   └── workflow/                       (workflow state machine)
│
├── hooks/                            ← ~15 lifecycle hooks
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
│   └── ...                             (+ 5 more hooks)
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
