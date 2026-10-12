import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readWorkState, writeWorkState } from "../features/work-state/storage"
import { saveWorkflowInstance, setActiveInstance } from "../features/workflow/storage"
import { checkCompactionRecovery } from "./compaction-recovery"

let directory: string
let planPath: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "lead-compaction-recovery-"))
  planPath = join(directory, "plan.md")
  writeFileSync(planPath, "# Plan\n## Progress\n- [ ] First\n- [ ] Second\n")
  writeWorkState(directory, {
    active_plan: planPath,
    started_at: "2026-01-01T00:00:00Z",
    session_ids: ["owner"],
    plan_name: "Plan",
    paused: false,
  })
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe("checkCompactionRecovery", () => {
  it("recovers fresh progress from disk and preserves verification discipline", () => {
    const options = { directory, sessionId: "owner" }
    expect(checkCompactionRecovery(options).recoveryPrompt).toContain("0/2 tasks complete")
    writeFileSync(planPath, "## Progress\n- [x] First\n- [ ] Second\n## TODOs\n- [ ] Detail\n")
    const result = checkCompactionRecovery(options)
    expect(result.recoveryPrompt).toContain("1/2 tasks complete")
    expect(result.recoveryPrompt).toContain("Read the plan file from disk as your first action")
    expect(result.recoveryPrompt).toContain("unchecked until the tester returns [PASS]")
    expect(result.recoveryPrompt).not.toMatch(/todowrite|seed/i)
  })

  it("does not recover another session's plan or a paused plan", () => {
    expect(checkCompactionRecovery({ directory, sessionId: "other" }).recoveryPrompt).toBeNull()
    writeWorkState(directory, { ...readWorkState(directory)!, paused: true })
    expect(checkCompactionRecovery({ directory, sessionId: "owner" }).recoveryPrompt).toBeNull()
    expect(readWorkState(directory)?.paused).toBe(true)
  })

  it("does not resume a completed plan because detail checkboxes remain unchecked", () => {
    writeFileSync(planPath, "## Progress\n- [x] Done\n## TODOs\n- [ ] Detail\n")
    expect(checkCompactionRecovery({ directory, sessionId: "owner" }).recoveryPrompt).toBeNull()
  })

  it.each(["running", "paused"] as const)("scopes %s workflow recovery independently from the plan", (status) => {
    saveWorkflowInstance(directory, {
      instance_id: "flow",
      definition_id: "test",
      definition_name: "Test workflow",
      definition_path: "test.jsonc",
      goal: "Verify recovery",
      slug: "test",
      status,
      started_at: "2026-01-01T00:00:00Z",
      session_ids: ["workflow-owner"],
      current_step_id: "step",
      steps: {},
      artifacts: {},
    })
    setActiveInstance(directory, "flow")
    expect(checkCompactionRecovery({ directory, sessionId: "other" }).recoveryPrompt).toBeNull()
    expect(checkCompactionRecovery({ directory, sessionId: "owner" }).recoveryPrompt).not.toContain("Active Workflow")
    const result = checkCompactionRecovery({ directory, sessionId: "workflow-owner" })
    if (status === "running") {
      expect(result.recoveryPrompt).toContain("Active Workflow: Test workflow")
      expect(result.recoveryPrompt).not.toContain("Active Plan")
    } else {
      expect(result.recoveryPrompt).toBeNull()
    }
  })
})
