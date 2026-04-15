import { randomBytes } from "crypto"
import {
  saveWorkflowInstance,
  loadActiveInstance,
  setActiveInstance,
  clearActiveInstance,
} from "./storage"
import { buildStepContext } from "./context"
import { checkStepCompletion } from "./completion"
import type {
  WorkflowDefinition,
  WorkflowInstance,
  StepState,
  EngineAction,
  CompletionContext,
} from "./types"

function generateInstanceId(): string {
  return "wf_" + randomBytes(4).toString("hex")
}

function generateSlug(goal: string): string {
  return goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "")
}

function nowIso(): string {
  return new Date().toISOString()
}

export interface StartWorkflowInput {
  definition: WorkflowDefinition
  definitionPath: string
  goal: string
  sessionId: string
  directory: string
}

export function startWorkflow(input: StartWorkflowInput): EngineAction {
  const { definition, definitionPath, goal, sessionId, directory } = input

  const instanceId = generateInstanceId()
  const slug = generateSlug(goal)
  const firstStep = definition.steps[0]

  // Initialize step states
  const steps: Record<string, StepState> = {}
  for (const [i, stepDef] of definition.steps.entries()) {
    steps[stepDef.id] = {
      id: stepDef.id,
      status: i === 0 ? "active" : "pending",
    }
  }

  const instance: WorkflowInstance = {
    instance_id: instanceId,
    definition_id: definition.name,
    definition_name: definition.name,
    definition_path: definitionPath,
    goal,
    slug,
    status: "running",
    started_at: nowIso(),
    session_ids: [sessionId],
    current_step_id: firstStep.id,
    steps,
    artifacts: {},
  }

  saveWorkflowInstance(directory, instance)
  setActiveInstance(directory, instanceId)

  const prompt = buildStepContext(instance, firstStep, definition)
  return { type: "inject_prompt", prompt, agent: firstStep.agent }
}

export interface CheckAndAdvanceInput {
  directory: string
  context: Omit<CompletionContext, "config" | "artifacts">
  definition: WorkflowDefinition
}

export function checkAndAdvance(input: CheckAndAdvanceInput): EngineAction {
  const { directory, context, definition } = input

  const instance = loadActiveInstance(directory)
  if (!instance || instance.status !== "running") {
    return { type: "none" }
  }

  const currentStepDef = definition.steps.find((s) => s.id === instance.current_step_id)
  if (!currentStepDef) {
    return { type: "none" }
  }

  const result = checkStepCompletion(currentStepDef.completion.method, {
    ...context,
    config: currentStepDef.completion,
    artifacts: instance.artifacts,
  })

  if (!result.complete) {
    return { type: "none" }
  }

  // Handle gate rejection
  if (result.verdict === "reject") {
    const onReject = currentStepDef.on_reject ?? "pause"
    if (onReject === "pause") {
      instance.status = "paused"
      instance.pause_reason = result.summary
    } else {
      instance.status = "failed"
      instance.ended_at = nowIso()
      clearActiveInstance(directory)
    }
    instance.steps[currentStepDef.id].status = "failed"
    instance.steps[currentStepDef.id].verdict = "reject"
    saveWorkflowInstance(directory, instance)
    return { type: "pause", reason: result.summary }
  }

  // Mark current step complete
  instance.steps[currentStepDef.id].status = "completed"
  instance.steps[currentStepDef.id].completed_at = nowIso()
  instance.steps[currentStepDef.id].verdict = result.verdict
  instance.steps[currentStepDef.id].summary = result.summary

  // Accumulate artifacts
  if (result.artifacts) {
    Object.assign(instance.artifacts, result.artifacts)
  }

  // Find next step
  const currentIndex = definition.steps.findIndex((s) => s.id === instance.current_step_id)
  const nextStep = definition.steps[currentIndex + 1]

  if (!nextStep) {
    // Workflow complete
    instance.status = "completed"
    instance.ended_at = nowIso()
    saveWorkflowInstance(directory, instance)
    clearActiveInstance(directory)
    return { type: "complete", reason: "All workflow steps completed" }
  }

  // Advance to next step
  instance.current_step_id = nextStep.id
  instance.steps[nextStep.id].status = "active"
  instance.steps[nextStep.id].started_at = nowIso()
  saveWorkflowInstance(directory, instance)

  const prompt = buildStepContext(instance, nextStep, definition)
  return { type: "inject_prompt", prompt, agent: nextStep.agent }
}

export function pauseWorkflow(directory: string, reason?: string): boolean {
  const instance = loadActiveInstance(directory)
  if (!instance) return false
  instance.status = "paused"
  if (reason) instance.pause_reason = reason
  saveWorkflowInstance(directory, instance)
  return true
}

export function resumeWorkflow(directory: string, definition: WorkflowDefinition): EngineAction {
  const instance = loadActiveInstance(directory)
  if (!instance || instance.status !== "paused") return { type: "none" }
  instance.status = "running"
  instance.pause_reason = undefined
  saveWorkflowInstance(directory, instance)

  const stepDef = definition.steps.find((s) => s.id === instance.current_step_id)
  if (!stepDef) return { type: "none" }

  const prompt = buildStepContext(instance, stepDef, definition)
  return { type: "inject_prompt", prompt, agent: stepDef.agent }
}

export function skipStep(directory: string, definition: WorkflowDefinition): EngineAction {
  const instance = loadActiveInstance(directory)
  if (!instance) return { type: "none" }

  const currentStepDef = definition.steps.find((s) => s.id === instance.current_step_id)
  if (!currentStepDef) return { type: "none" }

  instance.steps[currentStepDef.id].status = "skipped"
  instance.steps[currentStepDef.id].completed_at = nowIso()

  const currentIndex = definition.steps.findIndex((s) => s.id === instance.current_step_id)
  const nextStep = definition.steps[currentIndex + 1]

  if (!nextStep) {
    instance.status = "completed"
    instance.ended_at = nowIso()
    saveWorkflowInstance(directory, instance)
    clearActiveInstance(directory)
    return { type: "complete" }
  }

  instance.current_step_id = nextStep.id
  instance.steps[nextStep.id].status = "active"
  instance.steps[nextStep.id].started_at = nowIso()
  saveWorkflowInstance(directory, instance)

  const prompt = buildStepContext(instance, nextStep, definition)
  return { type: "inject_prompt", prompt, agent: nextStep.agent }
}

export function abortWorkflow(directory: string): boolean {
  const instance = loadActiveInstance(directory)
  if (!instance) return false
  instance.status = "cancelled"
  instance.ended_at = nowIso()
  saveWorkflowInstance(directory, instance)
  clearActiveInstance(directory)
  return true
}
