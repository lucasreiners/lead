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
})
