import { describe, it, expect } from "bun:test"
import { buildCustomAgent } from "./custom-agent-factory"
import type { CustomAgentConfig } from "../config/schema"

describe("buildCustomAgent", () => {
  it("emits the variant when set in config", () => {
    const config: CustomAgentConfig = {
      description: "test agent",
      model: "gpt-4o",
      variant: "high",
      prompt: "Base prompt",
    }
    const result = buildCustomAgent("my-agent", config)
    expect(result.variant).toBe("high")
  })

  it("omits the variant key when not set in config", () => {
    const config: CustomAgentConfig = {
      description: "test agent",
      model: "gpt-4o",
      prompt: "Base prompt",
    }
    const result = buildCustomAgent("my-agent", config)
    expect("variant" in result).toBe(false)
  })
})
