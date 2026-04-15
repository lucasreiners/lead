import { describe, it, expect, beforeEach } from "bun:test"
import {
  buildAgent,
  stripDisabledAgentReferences,
  resetNameVariants,
  registerAgentNameVariants,
} from "./agent-builder"
import type { AgentConfig } from "@opencode-ai/sdk"

beforeEach(() => {
  resetNameVariants()
})

describe("buildAgent with static config", () => {
  it("returns config as-is for simple static input", () => {
    const config: AgentConfig = { model: "gpt-4o", description: "test" }
    const result = buildAgent(config, "gpt-4o")
    expect(result.model).toBe("gpt-4o")
    expect(result.description).toBe("test")
  })

  it("uses the model parameter when factory-built", () => {
    const factory = Object.assign(
      (model: string): AgentConfig => ({ model, description: "factory agent" }),
      { mode: "subagent" as const }
    )
    const result = buildAgent(factory, "claude-3-5-sonnet")
    expect(result.model).toBe("claude-3-5-sonnet")
    expect(result.description).toBe("factory agent")
  })
})

describe("buildAgent — skill resolution", () => {
  it("prepends skill content to prompt", () => {
    const config: AgentConfig & { skills?: string[] } = {
      model: "gpt-4o",
      prompt: "Base prompt",
      skills: ["sdd-planning"],
    }
    const resolveSkills = (_names: string[]) => "# SDD Planning\nContent here"
    const result = buildAgent(config, "gpt-4o", { resolveSkills })
    expect(result.prompt).toContain("# SDD Planning")
    expect(result.prompt).toContain("Base prompt")
    expect(result.prompt!.indexOf("# SDD Planning")).toBeLessThan(result.prompt!.indexOf("Base prompt"))
  })

  it("skips skill resolution when no resolveSkills provided", () => {
    const config: AgentConfig & { skills?: string[] } = {
      model: "gpt-4o",
      prompt: "Base prompt",
      skills: ["sdd-planning"],
    }
    const result = buildAgent(config, "gpt-4o")
    expect(result.prompt).toBe("Base prompt")
  })

  it("skips disabled skills", () => {
    const config: AgentConfig & { skills?: string[] } = {
      model: "gpt-4o",
      prompt: "Base",
      skills: ["skill-a", "skill-b"],
    }
    const resolveSkills = (names: string[], disabled?: Set<string>) => {
      return names.filter((n) => !disabled?.has(n)).join(",")
    }
    const result = buildAgent(config, "gpt-4o", {
      resolveSkills,
      disabledSkills: new Set(["skill-a"]),
    })
    expect(result.prompt).toContain("skill-b")
    expect(result.prompt).not.toContain("skill-a")
  })
})

describe("stripDisabledAgentReferences", () => {
  it("removes lines mentioning disabled agents", () => {
    const prompt = `Use the architect to plan.
Then delegate to the code-analyst for exploration.
Finally ask the reviewer to check.`
    const result = stripDisabledAgentReferences(prompt, new Set(["code-analyst"]))
    expect(result).not.toContain("code-analyst")
    expect(result).toContain("architect")
    expect(result).toContain("reviewer")
  })

  it("removes lines with capitalized variants", () => {
    const prompt = `Ask Code Analyst to explore the codebase.
The researcher will look it up.`
    const result = stripDisabledAgentReferences(prompt, new Set(["code-analyst"]))
    expect(result).not.toContain("Code Analyst")
    expect(result).toContain("researcher")
  })

  it("returns unchanged prompt when no agents disabled", () => {
    const prompt = "Use architect, code-analyst, and reviewer"
    const result = stripDisabledAgentReferences(prompt, new Set())
    expect(result).toBe(prompt)
  })
})

describe("buildAgent — disabled agents", () => {
  it("strips disabled agent references from prompt", () => {
    const config: AgentConfig = {
      model: "gpt-4o",
      prompt: "Ask the code-analyst to explore.\nThen use the architect for planning.",
    }
    const result = buildAgent(config, "gpt-4o", { disabledAgents: new Set(["code-analyst"]) })
    expect(result.prompt).not.toContain("code-analyst")
    expect(result.prompt).toContain("architect")
  })
})
