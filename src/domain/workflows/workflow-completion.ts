import type { CompletionContext, CompletionCheckResult, CompletionMethod } from "../../features/workflow/types"

/**
 * Interface for step completion detection.
 * Implementation lives in features/workflow/completion.
 */
export interface WorkflowCompletion {
  /** Check if the current step is complete */
  check(method: CompletionMethod, context: CompletionContext): CompletionCheckResult
}
