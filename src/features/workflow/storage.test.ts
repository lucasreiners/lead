import { describe, it, expect } from "bun:test"
import { mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  saveWorkflowInstance,
  loadWorkflowInstance,
  loadActiveInstance,
  setActiveInstance,
  clearActiveInstance,
} from "./storage"
import type { WorkflowInstance } from "./types"

function makeInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    instance_id: "wf_test01",
    definition_id: "test-workflow",
    definition_name: "Test Workflow",
    definition_path: "/path/to/def.json",
    goal: "test goal",
    slug: "test-goal",
    status: "running",
    started_at: new Date().toISOString(),
    session_ids: ["s1"],
    current_step_id: "step-one",
    steps: { "step-one": { id: "step-one", status: "active" } },
    artifacts: {},
    ...overrides,
  }
}

describe("workflow storage", () => {
  it("saves and loads workflow instance", () => {
    const dir = join(tmpdir(), `wf-store-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const inst = makeInstance()
    saveWorkflowInstance(dir, inst)

    const loaded = loadWorkflowInstance(dir, inst.instance_id)
    expect(loaded).not.toBeNull()
    expect(loaded!.instance_id).toBe("wf_test01")
    expect(loaded!.goal).toBe("test goal")

    rmSync(dir, { recursive: true, force: true })
  })

  it("returns null for unknown instance", () => {
    const dir = join(tmpdir(), `wf-miss-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    expect(loadWorkflowInstance(dir, "wf_nonexistent")).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })

  it("sets and loads active instance", () => {
    const dir = join(tmpdir(), `wf-active-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const inst = makeInstance()
    saveWorkflowInstance(dir, inst)
    setActiveInstance(dir, inst.instance_id)

    const active = loadActiveInstance(dir)
    expect(active).not.toBeNull()
    expect(active!.instance_id).toBe("wf_test01")

    rmSync(dir, { recursive: true, force: true })
  })

  it("clearActiveInstance removes active pointer", () => {
    const dir = join(tmpdir(), `wf-clear-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const inst = makeInstance()
    saveWorkflowInstance(dir, inst)
    setActiveInstance(dir, inst.instance_id)
    clearActiveInstance(dir)

    expect(loadActiveInstance(dir)).toBeNull()

    rmSync(dir, { recursive: true, force: true })
  })
})
