import { describe, it, expect, afterEach } from "bun:test"
import { readWorkState, writeWorkState, clearWorkState, getPlanProgress } from "./storage"
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("readWorkState / writeWorkState / clearWorkState", () => {
  let tmpDir: string

  it("returns null when no state file exists", () => {
    const dir = join(tmpdir(), `ws-test-empty-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    expect(readWorkState(dir)).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it("writes and reads back work state", () => {
    const dir = join(tmpdir(), `ws-test-rw-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const state = {
      active_plan: "/some/plan.md",
      started_at: "2024-01-01T00:00:00Z",
      session_ids: ["s1", "s2"],
      plan_name: "my-plan",
      paused: false,
    }

    writeWorkState(dir, state)
    const read = readWorkState(dir)
    expect(read).not.toBeNull()
    expect(read!.active_plan).toBe("/some/plan.md")
    expect(read!.plan_name).toBe("my-plan")
    expect(read!.session_ids).toEqual(["s1", "s2"])

    rmSync(dir, { recursive: true, force: true })
  })

  it("clearWorkState removes the state file", () => {
    const dir = join(tmpdir(), `ws-test-clear-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const state = {
      active_plan: "/plan.md",
      started_at: "2024-01-01T00:00:00Z",
      session_ids: [],
      plan_name: "plan",
    }

    writeWorkState(dir, state)
    expect(readWorkState(dir)).not.toBeNull()
    clearWorkState(dir)
    expect(readWorkState(dir)).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })
})

describe("getPlanProgress", () => {
  it.each([
    ["details and verification", "## Progress\n- [x] Task\n## TODOs\n- [ ] Task detail\n## Verification\n- [ ] Verify", 1, 1],
    ["empty authoritative section", "## Progress\n## TODOs\n- [ ] Detail", 0, 0],
    ["nested headings and uppercase checks", "## Progress\r\n### Phase one\r\n- [X] Done\r\n- [ ] Next\r\n# Appendix\r\n- [ ] Outside", 2, 1],
    ["fenced examples", "```md\n## Progress\n- [ ] Example\n```\n## Progress\n- [x] Done\n~~~md\n- [ ] Example\n~~~\nText mentions - [ ] inline", 1, 1],
    ["old checklist format", "# Existing plan\n## TODOs\n- [x] Done\n- [ ] Next", 2, 1],
  ])("counts only real progress for %s", (_label, content, total, completed) => {
    const dir = mkdtempSync(join(tmpdir(), "plan-progress-sections-"))
    try {
      const planPath = join(dir, "plan.md")
      writeFileSync(planPath, content)
      expect(getPlanProgress(planPath)).toEqual({ total, completed, isComplete: total === completed })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("returns all zeros for non-existent file", () => {
    const result = getPlanProgress("/does/not/exist.md")
    expect(result.total).toBe(0)
    expect(result.completed).toBe(0)
    expect(result.isComplete).toBe(false)
  })

  it("counts unchecked and checked boxes", () => {
    const dir = join(tmpdir(), `plan-progress-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const planPath = join(dir, "plan.md")
    writeFileSync(planPath, `
# My Plan

## TODOs

- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4
    `)

    const result = getPlanProgress(planPath)
    expect(result.total).toBe(4)
    expect(result.completed).toBe(2)
    expect(result.isComplete).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it("marks complete when all checkboxes checked", () => {
    const dir = join(tmpdir(), `plan-done-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const planPath = join(dir, "plan.md")
    writeFileSync(planPath, `
- [x] Task 1
- [x] Task 2
    `)

    const result = getPlanProgress(planPath)
    expect(result.isComplete).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it("marks complete for plans with no checkboxes", () => {
    const dir = join(tmpdir(), `plan-nochk-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const planPath = join(dir, "plan.md")
    writeFileSync(planPath, "# Just a plan\n\nNo tasks.")

    const result = getPlanProgress(planPath)
    expect(result.total).toBe(0)
    expect(result.isComplete).toBe(true) // per spec: total === 0 → complete

    rmSync(dir, { recursive: true, force: true })
  })
})
