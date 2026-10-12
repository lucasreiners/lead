import { afterEach, describe, expect, it } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Agent, type Plugin } from "@opencode/plugin"
import type { CommandDefinition } from "@opencode/plugin/promise/command"
import { createHooks } from "../../hooks/create-hooks"
import { resolveContinuationConfig } from "../../config/continuation"
import { readWorkState, writeWorkState } from "../../features/work-state/storage"
import { setupV2 } from "./v2-setup"
import { registerV2Hooks } from "./v2-hooks"
import type { LeadConfig } from "../../config/schema"

const cleanups: Array<() => void | Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

function harness(pluginConfig: LeadConfig = {}) {
  const directory = mkdtempSync(join(tmpdir(), "lead-v2-"))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  const sessionHooks: Record<string, (event: any) => Promise<void> | void> = {}
  const toolHooks: Record<string, (event: any) => Promise<void> | void> = {}
  let permissionHook: (event: any) => Promise<void> | void
  const commands = new Map<string, CommandDefinition>()
  const agents = new Map<string, any>()
  const calls: Array<{ method: string; input: any }> = []
  const locations = new Map<string, string>()
  let defaultAgent: string | undefined
  let signal: AbortSignal | undefined
  let wake: (() => void) | undefined
  const queue: Array<{ event: any; done: () => void }> = []
  const ctx = {
    location: { directory, project: { id: "project", directory, canonical: directory } },
    options: pluginConfig,
    agent: {
      transform: async (callback: any) => callback({
        get: (id: string) => agents.get(id),
        list: () => [...agents.values()],
        update: (id: string, update: any) => {
          const agent = agents.get(id) ?? Agent.Info.default(Agent.ID.make(id))
          update(agent)
          agents.set(id, agent)
        },
        default: (id: string) => { defaultAgent = id },
        remove: (id: string) => { agents.delete(id) },
      }),
    },
    skill: { list: async () => ({ data: [{ id: "review-skill", name: "Review", content: "Skill instruction from V2", path: "/skill/SKILL.md" }] }) },
    command: { transform: async (callback: any) => callback({ add: (definition: CommandDefinition) => commands.set(definition.name, definition) }) },
    tool: {
      hook: async (name: string, callback: any) => { toolHooks[name] = callback },
    },
    permission: { hook: async (_name: string, callback: any) => { permissionHook = callback } },
    session: {
      hook: async (name: string, callback: any) => { sessionHooks[name] = callback },
      get: async ({ sessionID }: { sessionID: string }) => ({ location: { directory: locations.get(sessionID) ?? directory } }),
      prompt: async (input: any) => { calls.push({ method: "prompt", input }) },
      switchAgent: async (input: any) => { calls.push({ method: "switchAgent", input }) },
    },
    event: {
      async *subscribe(options: { signal: AbortSignal }) {
        signal = options.signal
        const abort = () => wake?.()
        signal.addEventListener("abort", abort)
        try {
          while (!signal.aborted) {
            const item = queue.shift()
            if (!item) {
              await new Promise<void>((resolve) => { wake = resolve })
              continue
            }
            yield item.event
            item.done()
          }
        } finally {
          signal.removeEventListener("abort", abort)
        }
      },
    },
  } as unknown as Plugin.Context
  const options = {
    pluginConfig,
    continuation: resolveContinuationConfig(pluginConfig.continuation),
    hooks: createHooks({ pluginConfig, continuation: resolveContinuationConfig(pluginConfig.continuation), directory }),
  }
  return {
    ctx, options, directory, sessionHooks, toolHooks, commands, agents, calls, locations,
    permission: (event: any) => permissionHook(event),
    defaultAgent: () => defaultAgent,
    aborted: () => signal?.aborted,
    emit: (event: any) => new Promise<void>((done) => { queue.push({ event, done }); wake?.() }),
    async start() { const cleanup = await registerV2Hooks(ctx, options); cleanups.push(cleanup); return cleanup },
  }
}

describe("OpenCode V2 runtime", () => {
  it("sets up agents, skills, commands and a disposable event subscription using V2 domains", async () => {
    const h = harness({ custom_agents: { "skill-reader": { prompt: "Read", skills: ["review-skill"] } } })
    const cleanup = await setupV2(h.ctx, "test")
    cleanups.push(cleanup)
    expect(h.agents.size).toBe(11)
    expect(h.defaultAgent()).toBe("tech-lead")
    expect(h.agents.get("skill-reader").system).toContain("Skill instruction from V2")
    expect(h.agents.get("architect").permissions).toContainEqual({ action: "edit", resource: "*", effect: "allow" })
    expect([...h.commands.keys()]).toEqual(["implement", "run-workflow", "finalize-issue", "read-existing-issue"])
    await cleanup()
    expect(h.aborted()).toBe(true)
  })

  it("routes commands with the session location, agent, delivery and attachments", async () => {
    const h = harness()
    await h.start()
    const files = [{ uri: "file:///notes.md", mention: { start: 0, end: 4 } }]
    await h.commands.get("read-existing-issue")!.execute({ sessionID: "session" as any, prompt: { text: "PROJ-123", files }, delivery: "queue" } as any)
    expect(h.calls[0]).toEqual({ method: "switchAgent", input: { sessionID: "session", agent: "product-owner" } })
    expect(h.calls[1].input).toMatchObject({ sessionID: "session", delivery: "queue", files })
    expect(h.calls[1].input.text).toContain("PROJ-123")
    expect(h.calls[1].input.text).toContain(".lead/requirements/{slug}.md")
  })

  it("captures only successful architect writes and resolves relative paths", async () => {
    const h = harness()
    await h.start()
    const event = { tool: "patch", sessionID: "session", agent: "architect", input: { patchText: "*** Begin Patch\n*** Add File: .lead/_adhoc/port.md\n+# Plan\n*** End Patch" } }
    await h.toolHooks["execute.after"]({ ...event, status: "error", error: { message: "failed" } })
    expect(readWorkState(h.directory)).toBeNull()
    mkdirSync(join(h.directory, ".lead/_adhoc"), { recursive: true })
    writeFileSync(join(h.directory, ".lead/_adhoc/port.md"), "# Plan")
    await h.toolHooks["execute.after"]({ ...event, status: "completed", result: { content: "ok" } })
    expect(readWorkState(h.directory)?.active_plan).toBe(join(h.directory, ".lead/_adhoc/port.md"))
    expect(readWorkState(h.directory)?.paused).toBe(true)
  })

  it("does not capture deleted plans or the old side of a rename", async () => {
    const h = harness()
    await h.start()
    await h.toolHooks["execute.after"]({ tool: "patch", sessionID: "session", agent: "architect", input: { patchText: "*** Delete File: .lead/_adhoc/old.md" }, status: "completed", result: { content: "ok" } })
    expect(readWorkState(h.directory)).toBeNull()
    mkdirSync(join(h.directory, ".lead/_adhoc"), { recursive: true })
    writeFileSync(join(h.directory, ".lead/_adhoc/new.md"), "# New plan")
    await h.toolHooks["execute.after"]({ tool: "patch", sessionID: "session", agent: "architect", input: { patchText: "*** Update File: .lead/_adhoc/old.md\n*** Move to: .lead/_adhoc/new.md" }, status: "completed", result: { content: "ok" } })
    expect(readWorkState(h.directory)?.active_plan).toBe(join(h.directory, ".lead/_adhoc/new.md"))
  })

  it("blocks patches and traversal outside the planning directory using native edit resources", async () => {
    const h = harness()
    await h.start()
    expect(() => h.toolHooks["execute.before"]({ tool: "patch", sessionID: "session", agent: "architect", input: { patchText: "*** Add File: src/index.ts\n+bad" } })).toThrow("Markdown")
    const event = { action: "edit", agent: "architect", sessionID: "session", resources: [".lead/../README.md"], effect: "allow" }
    await h.permission(event)
    expect(event.effect).toBe("deny")
    const valid = { ...event, resources: [".lead/TASK/plan.md"], effect: "allow" }
    await h.permission(valid)
    expect(valid.effect).toBe("allow")
  })

  it("recovers the current plan from disk after reload without a task tool or plugin storage", async () => {
    const h = harness()
    const cleanup = await h.start()
    mkdirSync(join(h.directory, ".lead"), { recursive: true })
    const plan = join(h.directory, ".lead/plan.md")
    writeFileSync(plan, "# Migration\n## Progress\n- [ ] Port hooks\n- [ ] Verify\n")
    writeWorkState(h.directory, { active_plan: plan, started_at: new Date().toISOString(), session_ids: ["session"], plan_name: "Migration", paused: false })
    await h.sessionHooks.prompt({ sessionID: "session", prompt: { text: "continue" } })
    await cleanup()
    expect(h.aborted()).toBe(true)
    await h.start()
    writeFileSync(plan, "# Migration\n## Progress\n- [x] Port hooks\n- [ ] Verify\n")
    const compaction = { sessionID: "session", system: [] as any[] }
    await h.sessionHooks.compaction(compaction)
    expect(compaction.system[0].text).toContain("1/2 tasks complete")
    expect(compaction.system[0].text).toContain(plan)
    expect(compaction.system[0].text).toContain("Read the plan")
  })

  it("uses V2 event data, ignores other locations and injects continuation into model context", async () => {
    const h = harness()
    await h.start()
    mkdirSync(join(h.directory, ".lead"), { recursive: true })
    const plan = join(h.directory, ".lead/plan.md")
    writeFileSync(plan, "# Plan\n## Progress\n- [ ] Port hooks\n")
    writeWorkState(h.directory, { active_plan: plan, started_at: new Date().toISOString(), session_ids: ["session", "foreign"], plan_name: "Migration", paused: false })
    h.locations.set("foreign", join(h.directory, "other"))
    await h.emit({ type: "session.status", data: { sessionID: "foreign", status: { type: "idle" } } })
    const foreign = { sessionID: "foreign", system: [] }
    await h.sessionHooks.context(foreign)
    expect(foreign.system).toEqual([])
    await h.emit({ type: "session.status", data: { sessionID: "session", status: { type: "idle" } } })
    const context = { sessionID: "session", system: [] as any[] }
    await h.sessionHooks.context(context)
    expect(context.system[0].text).toContain("Migration")
    const next = { sessionID: "session", system: [] }
    await h.sessionHooks.context(next)
    expect(next.system).toEqual([])
    await h.emit({ type: "session.status", data: { sessionID: "session", status: { type: "idle" } } })
    await h.emit({ type: "session.deleted", data: { sessionID: "session" } })
    await h.sessionHooks.context(next)
    expect(next.system).toEqual([])
  })

  it("switches agents when a workflow advances to its next step", async () => {
    const h = harness()
    await h.start()
    const workflowDir = join(h.directory, ".opencode/workflows")
    mkdirSync(workflowDir, { recursive: true })
    writeFileSync(join(workflowDir, "port.json"), JSON.stringify({
      name: "port", version: 1,
      steps: [
        { id: "plan", name: "Plan", type: "autonomous", agent: "architect", prompt: "Plan the migration", completion: { method: "plan_created", plan_name: "port" } },
        { id: "build", name: "Build", type: "autonomous", agent: "lead-dev", prompt: "Implement the migration", completion: { method: "agent_signal" } },
      ],
    }))
    await h.commands.get("run-workflow")!.execute({ sessionID: "session" as any, prompt: { text: "port migrate" }, delivery: "steer" })
    expect(h.calls[0]).toEqual({ method: "switchAgent", input: { sessionID: "session", agent: "architect" } })
    mkdirSync(join(h.directory, ".lead/_adhoc"), { recursive: true })
    writeFileSync(join(h.directory, ".lead/_adhoc/port.md"), "# Plan\n- [ ] Implement")
    await h.emit({ type: "session.status", data: { sessionID: "session", status: { type: "idle" } } })
    expect(h.calls.at(-1)).toEqual({ method: "switchAgent", input: { sessionID: "session", agent: "lead-dev" } })
    const context = { sessionID: "session", system: [] as any[] }
    await h.sessionHooks.context(context)
    expect(context.system[0].text).toContain("Implement the migration")
  })

  it("executes /implement against the session's current directory", async () => {
    const h = harness()
    await h.start()
    const moved = join(h.directory, "moved")
    mkdirSync(join(moved, ".lead/TASK-1"), { recursive: true })
    writeFileSync(join(moved, ".lead/TASK-1/plan.md"), "# Moved project plan\n## Progress\n- [ ] Implement")
    h.locations.set("session", moved)
    await h.commands.get("implement")!.execute({ sessionID: "session" as any, prompt: { text: "TASK-1" }, delivery: "steer" })
    expect(readWorkState(moved)?.active_plan).toBe(join(moved, ".lead/TASK-1/plan.md"))
    expect(readWorkState(h.directory)).toBeNull()
    expect(h.calls.at(-1)?.input.text).toContain("Moved project plan")
  })

  it("honors disabled hooks and continuation options", async () => {
    const h = harness({ disabled_hooks: ["architect-md-only"], continuation: { recovery: { compaction: false } } })
    await h.start()
    const event = { action: "edit", agent: "architect", sessionID: "session", resources: ["src/app.ts"], effect: "allow" }
    await h.permission(event)
    expect(event.effect).toBe("allow")
    mkdirSync(join(h.directory, ".lead"), { recursive: true })
    const plan = join(h.directory, ".lead/plan.md")
    writeFileSync(plan, "# Migration\n## Progress\n- [ ] Port hooks\n")
    writeWorkState(h.directory, { active_plan: plan, started_at: new Date().toISOString(), session_ids: ["session"], plan_name: "Migration", paused: false })
    const compaction = { sessionID: "session", system: [] }
    await h.sessionHooks.compaction(compaction)
    expect(compaction.system).toEqual([])
  })
})
