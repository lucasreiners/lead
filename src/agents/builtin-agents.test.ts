import { describe, it, expect } from "bun:test"
import { createBuiltinAgents, AGENT_METADATA, AGENT_FACTORIES } from "./builtin-agents"
import type { LeadAgentName } from "./types"

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
]

describe("createBuiltinAgents", () => {
  it("creates all 9 agents by default", () => {
    const agents = createBuiltinAgents()
    for (const name of ALL_AGENT_NAMES) {
      expect(agents[name]).toBeDefined()
    }
    expect(Object.keys(agents)).toHaveLength(9)
  })

  it("excludes disabled agents", () => {
    const agents = createBuiltinAgents({
      disabledAgents: new Set(["code-analyst", "guardian"]),
    })
    expect(agents["code-analyst"]).toBeUndefined()
    expect(agents.guardian).toBeUndefined()
    expect(agents["tech-lead"]).toBeDefined()
    expect(agents.reviewer).toBeDefined()
    expect(Object.keys(agents)).toHaveLength(7)
  })

  it("primary agents (tech-lead) use uiModel when provided", () => {
    const agents = createBuiltinAgents({ uiModel: "my-custom-model" })
    expect(agents["tech-lead"]?.model).toBe("my-custom-model")
  })

  it("strategic agents default to Opus", () => {
    const agents = createBuiltinAgents()
    expect(agents["tech-lead"]?.model).toBe("github-copilot/claude-opus-4.6")
    expect(agents.architect?.model).toBe("github-copilot/claude-opus-4.6")
    expect(agents["lead-dev"]?.model).toBe("github-copilot/claude-opus-4.6")
  })

  it("engineering agents default to Sonnet", () => {
    const agents = createBuiltinAgents()
    expect(agents.engineer?.model).toBe("github-copilot/claude-sonnet-4.6")
    expect(agents["code-analyst"]?.model).toBe("github-copilot/claude-sonnet-4.6")
    expect(agents.researcher?.model).toBe("github-copilot/claude-sonnet-4.6")
    expect(agents.reviewer?.model).toBe("github-copilot/claude-sonnet-4.6")
    expect(agents.guardian?.model).toBe("github-copilot/claude-sonnet-4.6")
  })

  it("applies config overrides", () => {
    const agents = createBuiltinAgents({
      configOverrides: {
        "code-analyst": { model: "overridden-model" },
      },
    })
    expect(agents["code-analyst"]?.model).toBe("overridden-model")
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
  })
})

describe("AGENT_FACTORIES", () => {
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
