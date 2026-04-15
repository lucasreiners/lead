import { describe, it, expect } from "bun:test"
import { ConfigHandler } from "./config-handler"
import type { AgentConfig } from "@opencode-ai/sdk"

const mockAgent: AgentConfig = {
  model: "claude-3-5-sonnet",
  prompt: "You are a test agent.",
  description: "Test Agent",
  mode: "primary",
}

describe("ConfigHandler", () => {
  it("registers builtin agents into config", () => {
    const handler = new ConfigHandler({
      builtinAgents: { "tech-lead": mockAgent, "lead-dev": mockAgent },
    })

    const config: { agent?: Record<string, AgentConfig | undefined>; default_agent?: string } = {}
    handler.handle(config)

    expect(config.agent?.["Tech Lead"]).toBeDefined()
    expect(config.agent?.["Lead Developer"]).toBeDefined()
  })

  it("registers custom agents into config", () => {
    const handler = new ConfigHandler({
      builtinAgents: { "tech-lead": mockAgent },
      customAgents: { "my-custom": mockAgent },
    })

    const config: { agent?: Record<string, AgentConfig | undefined>; default_agent?: string } = {}
    handler.handle(config)

    expect(config.agent?.["my-custom"]).toBeDefined()
  })

  it("merges with existing config.agents", () => {
    const handler = new ConfigHandler({
      builtinAgents: { "tech-lead": mockAgent },
    })

    const config: { agent?: Record<string, AgentConfig | undefined>; default_agent?: string } = {
      agent: { existing: { model: "gpt-4o", prompt: "existing" } },
    }
    handler.handle(config)

    expect(config.agent?.existing).toBeDefined()
    expect(config.agent?.["Tech Lead"]).toBeDefined()
  })

  it("getAgentNames returns all registered names", () => {
    const handler = new ConfigHandler({
      builtinAgents: { "tech-lead": mockAgent, "lead-dev": mockAgent },
      customAgents: { custom: mockAgent },
    })

    const names = handler.getAgentNames()
    expect(names).toContain("tech-lead")
    expect(names).toContain("lead-dev")
    expect(names).toContain("custom")
  })
})
