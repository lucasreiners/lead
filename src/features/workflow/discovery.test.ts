import { describe, it, expect } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { parseWorkflowFile, discoverWorkflows } from "./discovery"

const validDefContent = JSON.stringify({
  name: "test-workflow",
  version: 1,
  steps: [
    {
      id: "step-one",
      name: "Step One",
      type: "interactive",
      agent: "tech-lead",
      prompt: "Do step one",
      completion: { method: "user_confirm" },
    },
  ],
})

describe("parseWorkflowFile", () => {
  it("parses a valid workflow definition file", () => {
    const dir = join(tmpdir(), `wf-parse-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, "test-workflow.json")
    writeFileSync(filePath, validDefContent)

    const result = parseWorkflowFile(filePath, "project")
    expect(result).not.toBeNull()
    expect(result!.definition.name).toBe("test-workflow")
    expect(result!.scope).toBe("project")

    rmSync(dir, { recursive: true, force: true })
  })

  it("returns null for invalid workflow definition", () => {
    const dir = join(tmpdir(), `wf-invalid-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, "bad.json")
    writeFileSync(filePath, JSON.stringify({ name: "x", version: 1, steps: [] }))

    const result = parseWorkflowFile(filePath, "project")
    expect(result).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it("returns null for non-existent file", () => {
    const result = parseWorkflowFile("/does/not/exist.json", "project")
    expect(result).toBeNull()
  })
})

describe("discoverWorkflows", () => {
  it("discovers workflow from .opencode/workflows/ directory", () => {
    const dir = join(tmpdir(), `wf-discover-${Date.now()}`)
    const wfDir = join(dir, ".opencode", "workflows")
    mkdirSync(wfDir, { recursive: true })
    writeFileSync(join(wfDir, "test-workflow.json"), validDefContent)

    const results = discoverWorkflows({ projectDirectory: dir })
    expect(results.some((r) => r.definition.name === "test-workflow")).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it("returns empty array when no workflows found", () => {
    const dir = join(tmpdir(), `wf-empty-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const results = discoverWorkflows({ projectDirectory: dir })
    expect(results).toEqual([])

    rmSync(dir, { recursive: true, force: true })
  })
})
