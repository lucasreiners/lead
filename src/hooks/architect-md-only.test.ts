import { describe, it, expect } from "bun:test"
import { checkArchitectWrite } from "./architect-md-only"

describe("checkArchitectWrite", () => {
  it("allows non-architect agents to write anything", () => {
    const result = checkArchitectWrite({
      toolName: "Write",
      args: { filePath: "/some/file.ts" },
      agentName: "lead-dev",
    })
    expect(result.verdict).toBe("allow")
  })

  it("allows architect to write .md files in .lead/", () => {
    const result = checkArchitectWrite({
      toolName: "Write",
      args: { filePath: "/project/.lead/PROJ-123/plan.md" },
      agentName: "architect",
    })
    expect(result.verdict).toBe("allow")
  })

  it("denies architect writing non-.md file", () => {
    const result = checkArchitectWrite({
      toolName: "Write",
      args: { filePath: "/project/src/index.ts" },
      agentName: "architect",
    })
    expect(result.verdict).toBe("deny")
    expect(result.reason).toContain(".md")
  })

  it("denies architect writing .md outside .lead/", () => {
    const result = checkArchitectWrite({
      toolName: "Write",
      args: { filePath: "/project/docs/readme.md" },
      agentName: "architect",
    })
    expect(result.verdict).toBe("deny")
    expect(result.reason).toContain(".lead/")
  })

  it("allows architect to use non-write tools", () => {
    const result = checkArchitectWrite({
      toolName: "Read",
      args: { filePath: "/project/src/index.ts" },
      agentName: "architect",
    })
    expect(result.verdict).toBe("allow")
  })

  it("allows when no agent specified", () => {
    const result = checkArchitectWrite({
      toolName: "Write",
      args: { filePath: "/project/src/index.ts" },
    })
    expect(result.verdict).toBe("allow")
  })
})
