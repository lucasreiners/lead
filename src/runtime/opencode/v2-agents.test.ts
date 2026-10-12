import { describe, expect, it } from "bun:test"
import { Agent, Model, type Plugin } from "@opencode/plugin"
import type { AgentConfig } from "../../agents/types"
import { buildCustomAgent } from "../../agents/custom-agent-factory"
import { getAgentDisplayName } from "../../shared/agent-display-names"
import { registerV2Agents } from "./v2-agents"

type Transform = Parameters<Plugin.Context["agent"]["transform"]>[0]
type Editor = Parameters<Transform>[0]
type Draft = Parameters<Parameters<Editor["update"]>[1]>[0]

function registry(initial: Record<string, Partial<Draft>> = {}) {
  let transform: Transform | undefined
  let agents = new Map<string, Draft>()
  let selected = "build"
  const editor: Editor = {
    list: () => [...agents.values()],
    get: (id) => agents.get(id),
    default: (id) => { selected = id ?? "build" },
    remove: (id) => { agents.delete(id) },
    update: (id, update) => {
      const agent = agents.get(id) ?? Agent.Info.default(Agent.ID.make(id))
      update(agent)
      Agent.Info.make(agent)
      agents.set(id, agent)
    },
  }
  const replay = () => {
    agents = new Map(Object.entries(initial).map(([id, value]) => [
      id,
      { ...Agent.Info.default(Agent.ID.make(id)), ...structuredClone(value) },
    ]))
    selected = "build"
    transform?.(editor)
  }
  const ctx = {
    agent: {
      transform: async (callback: Transform) => {
        transform = callback
        replay()
        return { dispose: async () => {} }
      },
    },
  } as unknown as Plugin.Context
  return { ctx, replay, get: (id: string) => agents.get(id), ids: () => [...agents.keys()], selected: () => selected }
}

describe("registerV2Agents", () => {
  it("registers stable IDs, human names, modes, and a visible primary default", async () => {
    const result = registry()
    await registerV2Agents(result.ctx, {
      "tech-lead": { mode: "primary", description: "Coordinates work" },
      "team/security-review": { mode: "subagent", name: Agent.Name.make("Security Review") },
    })
    expect(result.ids()).toEqual(["tech-lead", "team/security-review"])
    expect(result.get("tech-lead")).toMatchObject({
      id: "tech-lead", name: getAgentDisplayName("tech-lead"), description: "Coordinates work", mode: "primary",
    })
    expect(result.get("team/security-review")?.name).toBe("Security Review")
    expect(result.selected()).toBe("tech-lead")
  })

  it("does not select an absent, hidden, or subagent-only tech lead", async () => {
    const cases: Record<string, AgentConfig>[] = [
      { engineer: { mode: "subagent" } },
      { "tech-lead": { hidden: true } },
      { "tech-lead": { mode: "subagent" } },
    ]
    for (const agents of cases) {
      const result = registry({ "tech-lead": { mode: "primary" } })
      await registerV2Agents(result.ctx, agents)
      expect(result.selected()).toBe("build")
    }
  })

  it("registers fully resolved custom preferences and injected skills", async () => {
    const config = buildCustomAgent("writer", {
      prompt: "Write the requested document.",
      skills: ["house-style"],
      model: "openrouter/anthropic/claude#low",
      variant: "high",
      tools: { shell: false },
      mode: "all",
    }, { resolveSkills: () => "<skill>Use the house style.</skill>" })
    const result = registry()
    await registerV2Agents(result.ctx, { writer: config })
    expect(result.get("writer")?.system).toBe("<skill>Use the house style.</skill>\n\nWrite the requested document.")
    expect(result.get("writer")?.model).toEqual({ providerID: "openrouter", id: "anthropic/claude", variant: "high" })
    expect(result.get("writer")?.mode).toBe("all")
    expect(result.get("writer")).not.toHaveProperty("skills")
    expect(result.get("writer")?.permissions.at(-1)).toEqual({ action: "shell", resource: "*", effect: "deny" })
  })

  it("preserves ordered native permission exceptions", async () => {
    const result = registry()
    const permissions: NonNullable<AgentConfig["permissions"]> = [
      { action: "shell", resource: "*", effect: "ask" },
      { action: "shell", resource: "git status", effect: "allow" },
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "reviewer", effect: "allow" },
      { action: "company_tool", resource: "*", effect: "deny" },
    ]
    await registerV2Agents(result.ctx, { engineer: { permissions } })
    expect(result.get("engineer")?.permissions.slice(-permissions.length)).toEqual(permissions)
  })

  it("merges native request maps and preserves absent registry values", async () => {
    const result = registry({ engineer: {
      model: Model.Ref.parse("anthropic/claude#high"), system: "Earlier prompt", hidden: true, color: "#abcdef",
      request: { settings: { timeout: 5000 }, headers: { "x-existing": "yes" }, body: { seed: 2 } },
    } })
    await registerV2Agents(result.ctx, { engineer: {
      steps: 8,
      request: { settings: { transport: "http" }, headers: { "x-agent": "engineer" }, body: { temperature: 0.1 } },
    } })
    expect(result.get("engineer")).toMatchObject({
      system: "Earlier prompt", hidden: true, color: "#abcdef", steps: 8,
      model: { providerID: "anthropic", id: "claude", variant: "high" },
      request: {
        settings: { timeout: 5000, transport: "http" },
        headers: { "x-existing": "yes", "x-agent": "engineer" },
        body: { seed: 2, temperature: 0.1 },
      },
    })
  })

  it("replays deterministically and isolates input and later transform mutations", async () => {
    const result = registry()
    const agents = { engineer: {
      system: "Original",
      model: Model.Ref.parse("anthropic/claude#high"),
      permissions: [{ action: "shell", resource: "*", effect: "deny" as const }],
      request: { settings: {}, headers: {}, body: { thinking: { budget: 1000 } } },
    } }
    await registerV2Agents(result.ctx, agents)
    const original = structuredClone(result.get("engineer"))
    result.get("engineer")!.request.body.thinking.budget = 1
    result.get("engineer")!.permissions.push({ action: "shell", resource: "*", effect: "allow" })
    expect(agents.engineer.request.body.thinking.budget).toBe(1000)
    agents.engineer.system = "Changed after setup"
    result.replay()
    expect(result.get("engineer")).toEqual(original)
    result.replay()
    expect(result.get("engineer")).toEqual(original)
  })
})
