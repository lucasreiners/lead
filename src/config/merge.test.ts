import { describe, it, expect } from "bun:test"
import { mergeConfigs } from "./merge"

describe("mergeConfigs", () => {
  it("returns user config when project is empty", () => {
    const user = { log_level: "DEBUG" as const, disabled_agents: ["architect"] }
    const result = mergeConfigs(user, {})
    expect(result.log_level).toBe("DEBUG")
    expect(result.disabled_agents).toEqual(["architect"])
  })

  it("project scalar overrides user scalar", () => {
    const user = { log_level: "DEBUG" as const }
    const project = { log_level: "ERROR" as const }
    const result = mergeConfigs(user, project)
    expect(result.log_level).toBe("ERROR")
  })

  it("merges and deduplicates disabled_agents arrays", () => {
    const user = { disabled_agents: ["architect", "code-analyst"] }
    const project = { disabled_agents: ["code-analyst", "researcher"] }
    const result = mergeConfigs(user, project)
    expect(result.disabled_agents).toEqual(["architect", "code-analyst", "researcher"])
  })

  it("merges agent overrides — project wins on same key", () => {
    const user = { agents: { lead: { model: "gpt-4o" } } }
    const project = { agents: { lead: { model: "claude-3-5-sonnet" }, "code-analyst": { model: "gpt-4o-mini" } } }
    const result = mergeConfigs(user, project)
    expect(result.agents?.lead?.model).toBe("claude-3-5-sonnet")
    expect(result.agents?.["code-analyst"]?.model).toBe("gpt-4o-mini")
  })

  it("merges custom agents from both configs", () => {
    const user = { custom_agents: { "agent-a": { prompt: "A" } } }
    const project = { custom_agents: { "agent-b": { prompt: "B" } } }
    const result = mergeConfigs(user, project)
    expect(result.custom_agents?.["agent-a"]?.prompt).toBe("A")
    expect(result.custom_agents?.["agent-b"]?.prompt).toBe("B")
  })

  it("handles empty user and project", () => {
    const result = mergeConfigs({}, {})
    expect(result).toEqual({})
  })

  it("merges continuation config", () => {
    const user = { continuation: { recovery: { compaction: false }, idle: { enabled: true } } }
    const project = { continuation: { recovery: { compaction: true } } }
    const result = mergeConfigs(user, project)
    expect(result.continuation?.recovery?.compaction).toBe(true)
    expect(result.continuation?.idle?.enabled).toBe(true)
  })

  it("project variant overrides user variant for the same agent key", () => {
    const user = { agents: { lead: { variant: "low" } } }
    const project = { agents: { lead: { variant: "high" } } }
    const result = mergeConfigs(user, project)
    expect(result.agents?.lead?.variant).toBe("high")
  })

  it("project variant overrides user variant for the same category key", () => {
    const user = { categories: { engineering: { variant: "low" } } }
    const project = { categories: { engineering: { variant: "high" } } }
    const result = mergeConfigs(user, project)
    expect(result.categories?.engineering?.variant).toBe("high")
  })

  it("user variant survives when project only sets a different field on the same agent", () => {
    const user = { agents: { lead: { variant: "high" } } }
    const project = { agents: { lead: { model: "claude-3-5-sonnet" } } }
    const result = mergeConfigs(user, project)
    expect(result.agents?.lead?.variant).toBe("high")
    expect(result.agents?.lead?.model).toBe("claude-3-5-sonnet")
  })

  it("user variant survives when project only sets a different field on the same category", () => {
    const user = { categories: { engineering: { variant: "high" } } }
    const project = { categories: { engineering: { model: "gpt-4o" } } }
    const result = mergeConfigs(user, project)
    expect(result.categories?.engineering?.variant).toBe("high")
    expect(result.categories?.engineering?.model).toBe("gpt-4o")
  })
})
