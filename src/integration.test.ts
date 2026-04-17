import { describe, it, expect } from "bun:test"
import pluginModule from "./index"
import { LeadPlugin } from "./index"
import type { PluginModule } from "@opencode-ai/plugin"
import { getAgentDisplayName } from "./shared/agent-display-names"

describe("Lead Plugin integration", () => {
  it("satisfies PluginModule contract", () => {
    // PluginModule requires: { id?: string; server: Plugin }
    expect(pluginModule.id).toBe("lead")
    expect(typeof pluginModule.server).toBe("function")
    // Type-level check
    const _: PluginModule = pluginModule
  })

  it("plugin returns all required hook slots", async () => {
    const mockCtx = {
      client: { tui: { showToast: () => Promise.resolve() } } as any,
      project: { path: "/tmp/test" } as any,
      directory: "/tmp/lead-integration-test",
      worktree: "/tmp/lead-integration-test",
      serverUrl: new URL("http://localhost:3000"),
      $: null as any,
    }

    const hooks = await LeadPlugin(mockCtx)

    // Verify all hook slots that L.E.A.D. implements
    const expectedHooks = [
      "config",
      "tool",
      "chat.message",
      "chat.params",
      "event",
      "tool.execute.before",
      "tool.execute.after",
      "command.execute.before",
      "tool.definition",
      "experimental.session.compacting",
    ] as const

    for (const hookName of expectedHooks) {
      expect(hookName in hooks).toBe(true)
    }
  })

  it("config hook registers all 8 Lead agents", async () => {
    const mockCtx = {
      client: { tui: { showToast: () => Promise.resolve() } } as any,
      project: { path: "/tmp/test" } as any,
      directory: "/tmp/lead-integration-test2",
      worktree: "/tmp/lead-integration-test2",
      serverUrl: new URL("http://localhost:3000"),
      $: null as any,
    }

    const hooks = await LeadPlugin(mockCtx)
    const config: { agent?: Record<string, unknown>; default_agent?: string } = {}

    await hooks.config!(config as any)

    const registeredAgents = Object.keys(config.agent ?? {})
    const expectedAgents = [
      getAgentDisplayName("tech-lead"),
      "Lead Developer",
      "Engineer",
      "Architect",
      "Code Analyst",
      "Researcher",
      "Reviewer",
      "Tester",
      "Guardian",
    ]

    for (const agent of expectedAgents) {
      expect(registeredAgents).toContain(agent)
    }
  })
})
