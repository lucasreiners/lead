import { describe, it, expect } from "bun:test"
import pluginModule from "./index"
import { LeadPlugin } from "./index"

describe("Lead Plugin entry point", () => {
  it("default export is a valid PluginModule", () => {
    expect(pluginModule.id).toBe("lead")
    expect(typeof pluginModule.server).toBe("function")
  })

  it("named export LeadPlugin is the server function", () => {
    expect(typeof LeadPlugin).toBe("function")
    expect(pluginModule.server).toBe(LeadPlugin)
  })

  it("plugin function returns a Promise when invoked with mock ctx", async () => {
    const mockCtx = {
      client: { tui: { showToast: () => Promise.resolve() } } as any,
      project: { path: "/tmp/test", git: false } as any,
      directory: "/tmp/test-lead-entry",
      worktree: "/tmp/test-lead-entry",
      serverUrl: new URL("http://localhost:3000"),
      $: null as any,
    }

    const result = await LeadPlugin(mockCtx)

    // Must return an object with required hook keys
    expect(typeof result).toBe("object")
    expect(result).not.toBeNull()

    // Check that key hooks are present
    expect(typeof result.config).toBe("function")
    expect(typeof result["chat.message"]).toBe("function")
    expect(typeof result["command.execute.before"]).toBe("function")
    expect(typeof result["tool.execute.before"]).toBe("function")
    expect(typeof result["tool.execute.after"]).toBe("function")
    expect(typeof result["tool.definition"]).toBe("function")
    expect(typeof result["experimental.session.compacting"]).toBe("function")
    expect(typeof result.event).toBe("function")
  })

  it("plugin config hook registers agents", async () => {
    const mockCtx = {
      client: { tui: { showToast: () => Promise.resolve() } } as any,
      project: { path: "/tmp/test" } as any,
      directory: "/tmp/test-lead-entry2",
      worktree: "/tmp/test-lead-entry2",
      serverUrl: new URL("http://localhost:3000"),
      $: null as any,
    }

    const hooks = await LeadPlugin(mockCtx)
    const config: { agent?: Record<string, unknown>; default_agent?: string } = {}

    if (hooks.config) {
      await hooks.config(config as any)
    }

    // Should have registered at least some agents
    expect(config.agent).toBeDefined()
    const agentNames = Object.keys(config.agent ?? {})
    expect(agentNames.length).toBeGreaterThan(0)
  })
})
