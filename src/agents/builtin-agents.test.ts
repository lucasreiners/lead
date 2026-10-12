import { describe, it, expect } from "bun:test"
import { createBuiltinAgents, AGENT_METADATA, AGENT_FACTORIES } from "./builtin-agents"
import type { LeadAgentName } from "./types"
import { resolveModel } from "./types"
import { Agent } from "@opencode/plugin"
import { readFileSync } from "node:fs"

const ALL_AGENT_NAMES: LeadAgentName[] = [
  "tech-lead",
  "lead-dev",
  "engineer",
  "architect",
  "code-analyst",
  "researcher",
  "reviewer",
  "tester",
  "guardian",
  "product-owner",
]

describe("createBuiltinAgents", () => {
  it("creates all 10 agents by default", () => {
    const agents = createBuiltinAgents()
    for (const name of ALL_AGENT_NAMES) {
      expect(agents[name]).toBeDefined()
    }
    expect(Object.keys(agents)).toHaveLength(10)
  })

  it("excludes disabled agents", () => {
    const agents = createBuiltinAgents({
      disabledAgents: new Set(["code-analyst", "guardian"]),
    })
    expect(agents["code-analyst"]).toBeUndefined()
    expect(agents.guardian).toBeUndefined()
    expect(agents["tech-lead"]).toBeDefined()
    expect(agents.reviewer).toBeDefined()
    expect(Object.keys(agents)).toHaveLength(8)
  })

  it("primary agents (tech-lead) use uiModel when provided", () => {
    const agents = createBuiltinAgents({ uiModel: "custom/my-model" })
    expect(agents["tech-lead"]?.model).toEqual(resolveModel("custom/my-model"))
  })

  it("strategic agents default to Opus", () => {
    const agents = createBuiltinAgents()
    expect(agents["tech-lead"]?.model).toEqual(resolveModel("github-copilot/claude-opus-4.8"))
    expect(agents.architect?.model).toEqual(resolveModel("github-copilot/claude-opus-4.8"))
    expect(agents["lead-dev"]?.model).toEqual(resolveModel("github-copilot/claude-opus-4.8"))
  })

  it("engineering agents default to Sonnet", () => {
    const agents = createBuiltinAgents()
    expect(agents.engineer?.model).toEqual(resolveModel("github-copilot/claude-sonnet-4.6"))
    expect(agents["code-analyst"]?.model).toEqual(resolveModel("github-copilot/claude-sonnet-4.6"))
    expect(agents.researcher?.model).toEqual(resolveModel("github-copilot/claude-sonnet-4.6"))
    expect(agents.reviewer?.model).toEqual(resolveModel("github-copilot/claude-sonnet-4.6"))
    expect(agents.guardian?.model).toEqual(resolveModel("github-copilot/claude-sonnet-4.6"))
  })

  it("applies config overrides", () => {
    const agents = createBuiltinAgents({
      configOverrides: {
        "code-analyst": { model: "custom/overridden-model" },
      },
    })
    expect(agents["code-analyst"]?.model).toEqual(resolveModel("custom/overridden-model"))
  })

  it("applies a per-agent variant override", () => {
    const agents = createBuiltinAgents({
      configOverrides: {
        architect: { variant: "high" },
      },
    })
    expect(agents.architect?.model?.variant).toBe("high")
  })

  it("has no variant key when no override is provided", () => {
    const agents = createBuiltinAgents()
    expect(agents.architect?.model?.variant).toBeUndefined()
  })

  it("applies a category-level variant to agents in that category", () => {
    // architect is in the "planning" category (see AGENT_METADATA)
    const agents = createBuiltinAgents({
      buildOptions: { categories: { planning: { variant: "high" } } },
    })
    expect(agents.architect?.model?.variant).toBe("high")
  })

  it("does not apply a category variant to agents outside that category", () => {
    const agents = createBuiltinAgents({
      buildOptions: { categories: { planning: { variant: "high" } } },
    })
    expect(agents.reviewer?.model?.variant).toBeUndefined()
  })

  it("per-agent variant override beats a category-level variant", () => {
    const agents = createBuiltinAgents({
      buildOptions: { categories: { planning: { variant: "low" } } },
      configOverrides: { architect: { variant: "high" } },
    })
    expect(agents.architect?.model?.variant).toBe("high")
  })

  it("per-agent model override beats a category-level model", () => {
    const agents = createBuiltinAgents({
      buildOptions: { categories: { planning: { model: "custom/category-model" } } },
      configOverrides: { architect: { model: "custom/agent-model" } },
    })
    expect(agents.architect?.model).toEqual(resolveModel("custom/agent-model"))
  })

  it("uses an embedded per-agent model variant ahead of the category variant", () => {
    const agents = createBuiltinAgents({
      buildOptions: { categories: { planning: { variant: "high" } } },
      configOverrides: { architect: { model: "custom/agent-model#low" } },
    })
    expect(agents.architect?.model).toEqual({ providerID: "custom", id: "agent-model", variant: "low" })
  })

  it("retains a category variant when overriding only the model", () => {
    const agents = createBuiltinAgents({
      buildOptions: { categories: { planning: { variant: "high" } } },
      configOverrides: { architect: { model: "custom/agent-model" } },
    })
    expect(agents.architect?.model).toEqual(resolveModel("custom/agent-model#high"))
  })

  it("each agent has a description", () => {
    const agents = createBuiltinAgents()
    expect(agents["tech-lead"]?.description).toBe("Tech Lead")
    expect(agents["lead-dev"]?.description).toBe("Lead Developer")
    expect(agents.engineer?.description).toBe("Software Engineer")
    expect(agents.architect?.description).toBe("Software Architect")
    expect(agents["code-analyst"]?.description).toBe("Code Analyst")
    expect(agents.researcher?.description).toBe("Technical Researcher")
    expect(agents.reviewer?.description).toBe("Code Reviewer")
    expect(agents.guardian?.description).toBe("Security Guardian")
    expect(agents["product-owner"]?.description).toBe("Product Owner")
  })
})

describe("AGENT_FACTORIES", () => {
  it("emits native fields and preserves primary/subagent roles directly from factories", () => {
    for (const [name, factory] of Object.entries(AGENT_FACTORIES)) {
      const config = factory("anthropic/claude")
      expect(config.mode).toBe(factory.mode)
      expect(config.system).toBeTruthy()
      expect(config.request?.body.temperature).toBe(1)
      expect(config).not.toHaveProperty("prompt")
      expect(config).not.toHaveProperty("tools")
      Agent.Info.make({ ...Agent.Info.default(Agent.ID.make(name)), ...config })
    }
  })

  it("allows guarded planner edits and retains read-only restrictions", () => {
    const agents = createBuiltinAgents({ configOverrides: { engineer: { tools: { shell: false } } } })
    for (const name of ["architect", "product-owner"] as const) {
      expect(agents[name]?.permissions).toContainEqual({ action: "edit", resource: "*", effect: "allow" })
      expect(agents[name]?.permissions).toContainEqual({ action: "shell", resource: "*", effect: "deny" })
    }
    for (const name of ["tech-lead", "code-analyst", "researcher", "reviewer", "tester", "guardian"] as const) {
      expect(agents[name]?.permissions).toContainEqual({ action: "edit", resource: "*", effect: "deny" })
    }
    expect(agents.engineer?.permissions).toContainEqual({ action: "shell", resource: "*", effect: "deny" })
  })

  it("injects configured built-in skills", () => {
    const agents = createBuiltinAgents({
      configOverrides: { engineer: { skills: ["house-style"] } },
      buildOptions: { resolveSkills: (names) => names.join(",") },
    })
    expect(agents.engineer?.system).toStartWith("house-style\n\n")
  })

  it("keeps disk prompts and bundled fallback prompts synchronized", () => {
    for (const name of ALL_AGENT_NAMES) {
      const source = readFileSync(new URL(`./${name}/index.ts`, import.meta.url), "utf8")
      const inline = source.match(/const INLINE_PROMPT = `([\s\S]*?)`\n\nconst BASE_PROMPT/)?.[1]
      const markdown = readFileSync(new URL(`./${name}/prompt.md`, import.meta.url), "utf8").trim()
      expect(inline?.replaceAll("\\`", "`").replaceAll("\\${", "${").trim()).toBe(markdown)
    }
  })

  it("has all 8 agent factories", () => {
    for (const name of ALL_AGENT_NAMES) {
      expect(AGENT_FACTORIES[name]).toBeDefined()
      expect(typeof AGENT_FACTORIES[name]).toBe("function")
    }
  })

  it("each factory has a mode", () => {
    expect(AGENT_FACTORIES["tech-lead"].mode).toBe("primary")
    expect(AGENT_FACTORIES["lead-dev"].mode).toBe("primary")
    expect(AGENT_FACTORIES.engineer.mode).toBe("subagent")
    expect(AGENT_FACTORIES.architect.mode).toBe("subagent")
    expect(AGENT_FACTORIES["code-analyst"].mode).toBe("subagent")
    expect(AGENT_FACTORIES.researcher.mode).toBe("subagent")
    expect(AGENT_FACTORIES.reviewer.mode).toBe("subagent")
    expect(AGENT_FACTORIES.guardian.mode).toBe("subagent")
    expect(AGENT_FACTORIES["product-owner"].mode).toBe("primary")
  })
})

describe("AGENT_METADATA", () => {
  it("has metadata for all 8 agents", () => {
    for (const name of ALL_AGENT_NAMES) {
      expect(AGENT_METADATA[name]).toBeDefined()
      expect(AGENT_METADATA[name].triggers.length).toBeGreaterThan(0)
    }
  })
})
