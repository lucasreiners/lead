export { createHooks } from "./create-hooks"
export type { CreateHooksArgs, CreatedHooks } from "./create-hooks"

export { checkContextWindow } from "./context-window-monitor"
export type {
  TokenUsage,
  ContextWindowSeverity,
  ContextWindowCheckResult,
  ContextWindowThresholds,
} from "./context-window-monitor"

export { createWriteGuard } from "./write-existing-file-guard"
export type { WriteGuard, WriteGuardCheckResult } from "./write-existing-file-guard"

export { shouldInjectRules, getRulesForFile } from "./rules-injector"

export {
  shouldApplyVariant,
  markApplied,
  markSessionCreated,
  clearSession,
} from "./first-message-variant"

export { processMessageForKeywords } from "./keyword-detector"
export type { DetectedKeyword, KeywordDetectionResult } from "./keyword-detector"

export { checkArchitectWrite } from "./architect-md-only"
export type { ArchitectGuardInput } from "./architect-md-only"

export { handleStartImplementation } from "./start-implementation-hook"
export type { StartImplementationOptions, StartImplementationResult } from "./start-implementation-hook"

export { checkContinuation } from "./work-continuation"
export type { WorkContinuationOptions, WorkContinuationResult } from "./work-continuation"

export { checkCompactionRecovery } from "./compaction-recovery"
export type { CompactionRecoveryOptions, CompactionRecoveryResult } from "./compaction-recovery"

export { buildVerificationReminder } from "./verification-reminder"
export type {
  VerificationReminderOptions,
  VerificationReminderResult,
} from "./verification-reminder"

export { applyTodoDescriptionOverride } from "./todo-description-override"

export { checkStaleTodos } from "./todo-continuation-enforcer"
export type { TodoItem, TodoContinuationResult } from "./todo-continuation-enforcer"

export {
  saveTodoStateForCompaction,
  getPreservedTodoState,
  clearPreservedTodoState,
  buildTodoPreservationPrompt,
} from "./compaction-todo-preserver"

export { updateTokenState, getTokenState, resetTokenState } from "./session-token-state"
export type { TokenStateEntry } from "./session-token-state"

export { captureToDoWrite } from "./todo-writer"
export type { TodoWriterHookInput, TodoWriterHookResult } from "./todo-writer"
