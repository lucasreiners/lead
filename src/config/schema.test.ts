import { describe, it, expect } from "bun:test"
import { LeadConfigSchema } from "./schema"

describe("LeadConfigSchema", () => {
  it("parses empty object as valid config", () => {
    const result = LeadConfigSchema.parse({})
    expect(result).toEqual({})
  })

  it("parses full config with all fields", () => {
    const config = {
      disabled_agents: ["architect"],
      disabled_skills: ["sdd-planning"],
      disabled_tools: ["bash"],
      disabled_hooks: ["write-guard"],
      skill_directories: ["custom/skills"],
      log_level: "DEBUG",
      agents: {
        lead: { model: "gpt-4o", display_name: "Tech Lead" },
      },
      custom_agents: {
        "my-agent": {
          prompt: "You are a custom agent.",
          model: "claude-3-5-sonnet",
          mode: "subagent",
          skills: ["my-skill"],
        },
      },
      background: { max_concurrent: 3 },
      continuation: {
        recovery: { compaction: true },
        idle: { enabled: true, work: true, workflow: false },
      },
      workflows: {
        disabled_workflows: ["old-workflow"],
        directories: ["custom/workflows"],
      },
    }
    const result = LeadConfigSchema.parse(config)
    expect(result.disabled_agents).toEqual(["architect"])
    expect(result.agents?.lead?.model).toBe("gpt-4o")
    expect(result.log_level).toBe("DEBUG")
  })

  it("rejects invalid log_level", () => {
    expect(() => LeadConfigSchema.parse({ log_level: "VERBOSE" })).toThrow()
  })

  it("rejects invalid agent mode", () => {
    expect(() =>
      LeadConfigSchema.parse({
        custom_agents: { "x": { mode: "invalid" } },
      }),
    ).toThrow()
  })

  it("allows optional $schema field", () => {
    const result = LeadConfigSchema.parse({
      $schema: "https://lead.dev/schema.json",
    })
    expect(result.$schema).toBe("https://lead.dev/schema.json")
  })

  it("accepts variant on agents, custom_agents, and categories", () => {
    const config = {
      agents: {
        lead: { model: "gpt-4o", variant: "high" },
      },
      custom_agents: {
        "my-agent": { model: "claude-3-5-sonnet", variant: "low" },
      },
      categories: {
        engineering: { model: "claude-3-5-sonnet", variant: "medium" },
      },
    }
    const result = LeadConfigSchema.parse(config)
    expect(result.agents?.lead?.variant).toBe("high")
    expect(result.custom_agents?.["my-agent"]?.variant).toBe("low")
    expect(result.categories?.engineering?.variant).toBe("medium")
  })

  it("rejects non-string variant", () => {
    expect(() =>
      LeadConfigSchema.parse({
        agents: { lead: { variant: 123 } },
      }),
    ).toThrow()
    expect(() =>
      LeadConfigSchema.parse({
        custom_agents: { "x": { variant: 123 } },
      }),
    ).toThrow()
    expect(() =>
      LeadConfigSchema.parse({
        categories: { engineering: { variant: 123 } },
      }),
    ).toThrow()
  })
})
