import { describe, it, expect } from "bun:test"
import { substituteTemplateVars, buildStepContext } from "./context"
import type { WorkflowInstance, WorkflowStepDefinition, WorkflowDefinition } from "./types"

const mockStep: WorkflowStepDefinition = {
  id: "step-one",
  name: "Step One",
  type: "interactive",
  agent: "tech-lead",
  prompt: "Work on {{instance.goal}} for step {{step.id}}",
  completion: { method: "user_confirm" },
}

const mockInstance: WorkflowInstance = {
  instance_id: "wf_abc123",
  definition_id: "test-wf",
  definition_name: "Test Workflow",
  definition_path: "/path/to/def.jsonc",
  goal: "build a feature",
  slug: "build-a-feature",
  status: "running",
  started_at: "2024-01-01T00:00:00Z",
  session_ids: ["s1"],
  current_step_id: "step-one",
  steps: { "step-one": { id: "step-one", status: "active" } },
  artifacts: { plan_path: "/path/to/plan.md" },
}

const mockDef: WorkflowDefinition = {
  name: "test-wf",
  version: 1,
  steps: [mockStep],
}

describe("substituteTemplateVars", () => {
  it("substitutes instance.goal", () => {
    const result = substituteTemplateVars("Goal: {{instance.goal}}", mockInstance, mockStep)
    expect(result).toBe("Goal: build a feature")
  })

  it("substitutes instance.slug", () => {
    const result = substituteTemplateVars("{{instance.slug}}", mockInstance, mockStep)
    expect(result).toBe("build-a-feature")
  })

  it("substitutes artifact values", () => {
    const result = substituteTemplateVars("Plan: {{artifacts.plan_path}}", mockInstance, mockStep)
    expect(result).toBe("Plan: /path/to/plan.md")
  })

  it("returns placeholder for missing artifacts", () => {
    const result = substituteTemplateVars("{{artifacts.missing}}", mockInstance, mockStep)
    expect(result).toContain("not available")
  })

  it("substitutes step.id and step.name", () => {
    const result = substituteTemplateVars("Step: {{step.id}} ({{step.name}})", mockInstance, mockStep)
    expect(result).toBe("Step: step-one (Step One)")
  })
})

describe("buildStepContext", () => {
  it("includes workflow goal and step info", () => {
    const prompt = buildStepContext(mockInstance, mockStep, mockDef)
    expect(prompt).toContain("build a feature")
    expect(prompt).toContain("step-one")
    expect(prompt).toContain("test-wf")
  })

  it("includes artifact summary", () => {
    const prompt = buildStepContext(mockInstance, mockStep, mockDef)
    expect(prompt).toContain("plan_path")
  })
})
