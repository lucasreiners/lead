import { describe, it, expect } from "bun:test"
import { buildCustomAgent } from "./custom-agent-factory"
import type { CustomAgentConfig } from "../config/schema"

describe("buildCustomAgent", () => {
  it("keeps an unspecified model inherited and defaults custom agents to subagent mode", () => {
    const result = buildCustomAgent("my-agent", { prompt: "Base prompt" })
    expect(result.model).toBeUndefined()
    expect(result.mode).toBe("subagent")
  })

  it("resolves a variant-only preference against the agent tier default", () => {
    const result = buildCustomAgent("my-agent", { variant: "high" })
    expect(result.model).toEqual({ providerID: "github-copilot", id: "claude-sonnet-4.6", variant: "high" })
  })

  it("emits the variant when set in config", () => {
    const config: CustomAgentConfig = {
      description: "test agent",
      model: "openai/gpt-4o",
      variant: "high",
      prompt: "Base prompt",
    }
    const result = buildCustomAgent("my-agent", config)
    expect(result.model).toEqual({ providerID: "openai", id: "gpt-4o", variant: "high" })
    expect(result.system).toBe("Base prompt")
  })

  it("omits the variant key when not set in config", () => {
    const config: CustomAgentConfig = {
      description: "test agent",
      model: "openai/gpt-4o",
      prompt: "Base prompt",
    }
    const result = buildCustomAgent("my-agent", config)
    expect(result.model?.variant).toBeUndefined()
  })
})
