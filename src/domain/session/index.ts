/**
 * Session state tracking interfaces.
 * Tracks per-session token usage and idle state for hook coordination.
 */

export interface SessionTokenState {
  /** Session identifier */
  sessionId: string
  /** Total input tokens consumed in this session */
  inputTokens: number
  /** Total output tokens consumed in this session */
  outputTokens: number
  /** Timestamp of last activity */
  lastActivityAt: Date
}

export interface SessionIdleState {
  /** Session identifier */
  sessionId: string
  /** Whether the session is currently idle */
  isIdle: boolean
  /** Last assistant message content, if any */
  lastAssistantMessage?: string
  /** Last user message content, if any */
  lastUserMessage?: string
}

/**
 * Owner of the execution lease — determines which system drives the session.
 * Workflow takes precedence when both active.
 */
export type ExecutionLeaseOwner = "none" | "plan" | "workflow"

export interface ExecutionLeaseSnapshot {
  owner: ExecutionLeaseOwner
  hasActivePlan: boolean
  hasActiveWorkflow: boolean
  activePlanPaused: boolean
  activeWorkflowPaused: boolean
}

/**
 * Determine which system owns the current execution lease.
 * Workflow takes precedence if both are active and running.
 */
export function determineExecutionOwner(snapshot: ExecutionLeaseSnapshot): ExecutionLeaseOwner {
  if (snapshot.hasActiveWorkflow && !snapshot.activeWorkflowPaused) {
    return "workflow"
  }
  if (snapshot.hasActivePlan && !snapshot.activePlanPaused) {
    return "plan"
  }
  return "none"
}
