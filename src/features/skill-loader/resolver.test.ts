import { describe, it, expect } from "bun:test"
import { createSkillResolver } from "./resolver"
import type { SkillLoadResult } from "./types"

describe("createSkillResolver", () => {
  const mockResult: SkillLoadResult = {
    skills: [
      {
        name: "skill-a",
        content: "Content A",
        source: "project",
        metadata: { description: "Skill A" },
      },
      {
        name: "skill-b",
        content: "Content B",
        source: "user",
        metadata: {},
      },
      {
        name: "skill-c",
        content: "Content C",
        source: "custom",
        metadata: {},
      },
    ],
    errors: [],
  }

  it("returns concatenated content for matching skill names", () => {
    const resolver = createSkillResolver(mockResult)
    const result = resolver(["skill-a", "skill-b"])
    expect(result).toContain("Content A")
    expect(result).toContain("Content B")
  })

  it("returns empty string for unknown skill names", () => {
    const resolver = createSkillResolver(mockResult)
    const result = resolver(["nonexistent"])
    expect(result).toBe("")
  })

  it("filters out disabled skills", () => {
    const resolver = createSkillResolver(mockResult)
    const disabled = new Set(["skill-a"])
    const result = resolver(["skill-a", "skill-b"], disabled)
    expect(result).not.toContain("Content A")
    expect(result).toContain("Content B")
  })

  it("returns empty string for empty skill names array", () => {
    const resolver = createSkillResolver(mockResult)
    expect(resolver([])).toBe("")
  })

  it("joins multiple skills with double newline", () => {
    const resolver = createSkillResolver(mockResult)
    const result = resolver(["skill-a", "skill-b"])
    expect(result).toBe("Content A\n\nContent B")
  })
})
