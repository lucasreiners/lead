export type StepType = "interactive" | "autonomous" | "gate"

export type CompletionMethod =
  | "user_confirm"
  | "plan_created"
  | "plan_complete"
  | "review_verdict"
  | "agent_signal"

export type StepStatus =
  | "pending"
  | "active"
  | "awaiting_user"
  | "completed"
  | "failed"
  | "skipped"

export type WorkflowStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export type OnRejectAction = "pause" | "fail"

export interface CompletionConfig {
  method: CompletionMethod
  plan_name?: string
  keywords?: string[]
}

export interface StepArtifactRef {
  name: string
  description?: string
}

export interface StepArtifacts {
  inputs?: StepArtifactRef[]
  outputs?: StepArtifactRef[]
}

export interface WorkflowStepDefinition {
  id: string
  name: string
  type: StepType
  agent: string
  prompt: string
  completion: CompletionConfig
  artifacts?: StepArtifacts
  on_reject?: OnRejectAction
}

export interface WorkflowDefinition {
  name: string
  description?: string
  version: number
  steps: WorkflowStepDefinition[]
}

export interface StepState {
  id: string
  status: StepStatus
  started_at?: string
  completed_at?: string
  verdict?: "approve" | "reject"
  error?: string
  artifacts?: Record<string, string>
  summary?: string
}

export interface WorkflowInstance {
  instance_id: string
  definition_id: string
  definition_name: string
  definition_path: string
  goal: string
  slug: string
  status: WorkflowStatus
  started_at: string
  ended_at?: string
  session_ids: string[]
  current_step_id: string
  steps: Record<string, StepState>
  artifacts: Record<string, string>
  pause_reason?: string
}

export interface ActiveInstancePointer {
  instance_id: string
}

export interface CompletionContext {
  lastAssistantMessage?: string
  lastUserMessage?: string
  directory: string
  config: CompletionConfig
  artifacts: Record<string, string>
}

export interface CompletionCheckResult {
  complete: boolean
  verdict?: "approve" | "reject"
  artifacts?: Record<string, string>
  summary?: string
  reason?: string
}

export type EngineActionType = "inject_prompt" | "switch_agent" | "pause" | "complete" | "none"

export interface EngineAction {
  type: EngineActionType
  prompt?: string
  agent?: string
  reason?: string
}

export interface DiscoveredWorkflow {
  definition: WorkflowDefinition
  path: string
  scope: "project" | "user"
}
