import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readWorkState, writeWorkState } from "../features/work-state/storage"
import { checkContinuation } from "./work-continuation"

let directory: string
let planPath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "lead-continuation-"))
  planPath = join(directory, "plan.md")
  writeFileSync(planPath, "# Plan\n## Progress\n- [ ] Task\n")
  writeWorkState(directory, {
    active_plan: planPath,
    started_at: "2026-01-01T00:00:00Z",
    session_ids: ["owner"],
    plan_name: "Plan",
    paused: false,
  })
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe("checkContinuation", () => {
  it("does not adopt an unrelated session or mutate its state", () => {
    const before = readWorkState(directory)
    expect(checkContinuation({ directory, sessionId: "other" }).continuationPrompt).toBeNull()
    expect(readWorkState(directory)).toEqual(before)
  })

  it("does not resume paused work", () => {
    writeWorkState(directory, { ...readWorkState(directory)!, paused: true })
    expect(checkContinuation({ directory, sessionId: "owner" }).continuationPrompt).toBeNull()
    expect(readWorkState(directory)?.paused).toBe(true)
  })

  it("reads current progress and completes despite unchecked detail checklists", () => {
    const first = checkContinuation({ directory, sessionId: "owner" })
    expect(first.continuationPrompt).toContain("0/1 tasks complete")
    expect(first.continuationPrompt).toContain("unchecked until the tester returns [PASS]")
    expect(first.continuationPrompt).not.toMatch(/todowrite|seed/i)

    writeFileSync(planPath, "## Progress\n- [x] Task\n## TODOs\n- [ ] Detail\n")
    const complete = checkContinuation({ directory, sessionId: "owner" })
    expect(complete.planComplete).toBe(true)
    expect(complete.continuationPrompt).toContain("All 1 tasks done")
  })

  it("pauses stale work and resets the stale count when disk progress changes", () => {
    const options = { directory, sessionId: "owner", lastAssistantMessage: `${planPath}: - [ ] Task` }
    checkContinuation(options)
    checkContinuation(options)
    expect(readWorkState(directory)?.stale_continuation_count).toBe(2)

    writeFileSync(planPath, "## Progress\n- [x] Task\n- [ ] Next\n")
    checkContinuation(options)
    expect(readWorkState(directory)?.stale_continuation_count).toBe(0)
    expect(readWorkState(directory)?.continuation_completed_snapshot).toBe(1)

    checkContinuation(options)
    checkContinuation(options)
    expect(checkContinuation(options).continuationPrompt).toContain("paused after 3 continuations")
    expect(readWorkState(directory)?.paused).toBe(true)
    expect(checkContinuation(options).continuationPrompt).toBeNull()
  })
})
