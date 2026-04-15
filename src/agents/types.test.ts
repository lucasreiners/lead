import { describe, it, expect } from "bun:test"
import { isFactory, isGptModel, type AgentFactory, type LeadAgentName } from "./types"
import type { AgentConfig } from "@opencode-ai/sdk"

describe("isGptModel", () => {
  it("matches gpt- prefix", () => {
    expect(isGptModel("gpt-4o")).toBe(true)
    expect(isGptModel("gpt-4-turbo")).toBe(true)
  })

  it("matches o1/o3/o4 prefixes", () => {
    expect(isGptModel("o1-preview")).toBe(true)
    expect(isGptModel("o3-mini")).toBe(true)
    expect(isGptModel("o4-mini")).toBe(true)
  })

  it("rejects non-gpt models", () => {
    expect(isGptModel("claude-3-5-sonnet")).toBe(false)
    expect(isGptModel("anthropic/claude-opus")).toBe(false)
    expect(isGptModel("gemini-1.5-pro")).toBe(false)
  })
})

describe("isFactory", () => {
  it("returns true for factory function", () => {
    const factory = Object.assign((model: string): AgentConfig => ({ model }), { mode: "subagent" as const })
    expect(isFactory(factory)).toBe(true)
  })

  it("returns false for static AgentConfig", () => {
    const config: AgentConfig = { model: "gpt-4o", description: "test" }
    expect(isFactory(config)).toBe(false)
  })
})

describe("LeadAgentName type", () => {
  it("all 9 agent names are valid", () => {
    const names: LeadAgentName[] = [
      "tech-lead",
      "lead-dev",
      "engineer",
      "architect",
      "code-analyst",
      "researcher",
      "reviewer",
      "tester",
      "guardian",
    ]
    expect(names).toHaveLength(9)
  })
})
