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
        idle: { enabled: true, work: true, workflow: false, todo_prompt: true },
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
})
