import { describe, it, expect } from "bun:test"
import { WorkflowDefinitionSchema } from "./schema"

const validDef = {
  name: "my-workflow",
  version: 1 as const,
  steps: [
    {
      id: "step-one",
      name: "Step One",
      type: "interactive" as const,
      agent: "tech-lead",
      prompt: "Do step one for {{instance.goal}}",
      completion: { method: "user_confirm" as const },
    },
  ],
}

describe("WorkflowDefinitionSchema", () => {
  it("parses a valid workflow definition", () => {
    const result = WorkflowDefinitionSchema.safeParse(validDef)
    expect(result.success).toBe(true)
  })

  it("rejects missing required fields", () => {
    const result = WorkflowDefinitionSchema.safeParse({ name: "x", version: 1, steps: [] })
    expect(result.success).toBe(false)
  })

  it("rejects invalid step IDs (uppercase)", () => {
    const def = {
      ...validDef,
      steps: [{ ...validDef.steps[0], id: "STEP_ONE" }],
    }
    const result = WorkflowDefinitionSchema.safeParse(def)
    expect(result.success).toBe(false)
  })

  it("rejects duplicate step IDs", () => {
    const def = {
      ...validDef,
      steps: [validDef.steps[0], { ...validDef.steps[0] }],
    }
    const result = WorkflowDefinitionSchema.safeParse(def)
    expect(result.success).toBe(false)
  })
})
