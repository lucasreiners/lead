import { describe, it, expect } from "bun:test"
import { mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { startWorkflow } from "./engine"
import type { WorkflowDefinition } from "./types"

const testDefinition: WorkflowDefinition = {
  name: "test-workflow",
  version: 1,
  steps: [
    {
      id: "step-one",
      name: "Step One",
      type: "interactive",
      agent: "tech-lead",
      prompt: "Work on {{instance.goal}}",
      completion: { method: "user_confirm" },
    },
    {
      id: "step-two",
      name: "Step Two",
      type: "autonomous",
      agent: "architect",
      prompt: "Plan for {{instance.goal}}",
      completion: { method: "agent_signal" },
    },
  ],
}

describe("workflow engine - startWorkflow", () => {
  it("creates a workflow instance and returns inject_prompt action", () => {
    const dir = join(tmpdir(), `wf-engine-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const action = startWorkflow({
      definition: testDefinition,
      definitionPath: "/path/to/def.json",
      goal: "build a feature",
      sessionId: "session-1",
      directory: dir,
    })

    expect(action.type).toBe("inject_prompt")
    expect(action.prompt).toContain("build a feature")
    expect(action.agent).toBe("tech-lead")

    rmSync(dir, { recursive: true, force: true })
  })

  it("sets the active instance pointer", () => {
    const dir = join(tmpdir(), `wf-engine-active-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    startWorkflow({
      definition: testDefinition,
      definitionPath: "/path/to/def.json",
      goal: "test goal",
      sessionId: "s1",
      directory: dir,
    })

    const { loadActiveInstance } = require("./storage") as typeof import("./storage")
    const active = loadActiveInstance(dir)
    expect(active).not.toBeNull()
    expect(active!.goal).toBe("test goal")
    expect(active!.current_step_id).toBe("step-one")

    rmSync(dir, { recursive: true, force: true })
  })
})
