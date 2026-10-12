import { describe, it, expect, beforeEach } from "bun:test"
import { buildAgent, applyAgentPreferences, stripDisabledAgentReferences, resetNameVariants } from "./agent-builder"
import { resolveModel, type AgentConfig } from "./types"

beforeEach(resetNameVariants)

describe("native agent builder", () => {
  it("preserves native static input and resolves factory models", () => {
    const config: AgentConfig = { model: resolveModel("openai/gpt-4o"), system: "Base" }
    expect(buildAgent(config, "")).toEqual(config)
    const factory = Object.assign(
      (model: string): AgentConfig => ({ model: resolveModel(model), mode: "subagent" }),
      { mode: "subagent" as const },
    )
    expect(buildAgent(factory, "anthropic/claude").model).toEqual({ providerID: "anthropic", id: "claude" })
  })

  it("injects selected skills into system and filters disabled skills", () => {
    const config: AgentConfig = { system: "Base prompt" }
    const result = buildAgent(config, "", {
      skills: ["disabled", "house-style"],
      disabledSkills: new Set(["disabled"]),
      resolveSkills: (names, disabled) => names.filter((name) => !disabled?.has(name)).join(","),
    })
    expect(result.system).toBe("house-style\n\nBase prompt")
    expect(config.system).toBe("Base prompt")
    expect(result).not.toHaveProperty("skills")
  })

  it("resolves category model, variant and skills using the explicit category", () => {
    const result = buildAgent({ system: "Base" }, "", {
      category: "planning",
      categories: { planning: { model: "anthropic/claude", variant: "high", skills: ["planning"] } },
      resolveSkills: (names) => names.join(","),
    })
    expect(result.model).toEqual({ providerID: "anthropic", id: "claude", variant: "high" })
    expect(result.system).toBe("planning\n\nBase")
  })

  it("lets explicit skills override category skills", () => {
    const result = buildAgent({}, "", {
      category: "planning",
      skills: ["explicit"],
      categories: { planning: { skills: ["category"] } },
      resolveSkills: (names) => names.join(","),
    })
    expect(result.system).toBe("explicit")
  })

  it("preserves request maps while applying plugin preferences", () => {
    const result = applyAgentPreferences({
      request: { settings: { timeout: 1000 }, headers: { "x-team": "lead" }, body: { seed: 2 } },
    }, { model: "openrouter/anthropic/claude#low", variant: "high", temperature: 0, prompt: "Override" })
    expect(result.model).toEqual({ providerID: "openrouter", id: "anthropic/claude", variant: "high" })
    expect(result.request).toEqual({ settings: { timeout: 1000 }, headers: { "x-team": "lead" }, body: { seed: 2, temperature: 0 } })
    expect(result.system).toBe("Override")
  })

  it("normalizes configured tool restrictions without re-enabling denied aliases", () => {
    const result = applyAgentPreferences({ permissions: [{ action: "read", resource: "*.env", effect: "ask" }] }, {
      tools: { shell: false, subagent: true, edit: true, write: false, patch: true, company_tool: false, constructor: false },
    })
    expect(result.permissions).toEqual([
      { action: "read", resource: "*.env", effect: "ask" },
      { action: "shell", resource: "*", effect: "deny" },
      { action: "subagent", resource: "*", effect: "allow" },
      { action: "edit", resource: "*", effect: "deny" },
      { action: "company_tool", resource: "*", effect: "deny" },
      { action: "constructor", resource: "*", effect: "deny" },
    ])
  })

  it("strips disabled specialists from the system prompt", () => {
    const result = buildAgent({ system: "Ask Code Analyst to explore.\nAsk the architect to plan." }, "", {
      disabledAgents: new Set(["code-analyst"]),
    })
    expect(result.system).toBe("Ask the architect to plan.")
    expect(stripDisabledAgentReferences("Unchanged", new Set())).toBe("Unchanged")
  })
})
