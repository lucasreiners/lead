import { readWorkState, writeWorkState, getPlanProgress } from "../features/work-state/storage"

/**
 * Work continuation hook.
 * On session idle, checks if there is active work with remaining tasks.
 * Returns a continuation prompt if work is incomplete and not paused.
 */

export interface WorkContinuationOptions {
  /** Current session ID */
  sessionId: string
  /** Working directory */
  directory: string
  /** Last assistant message content (for detecting stale continuations) */
  lastAssistantMessage?: string
}

export interface WorkContinuationResult {
  /** Prompt to inject if continuation is needed */
  continuationPrompt: string | null
  /** Whether the plan is now complete */
  planComplete?: boolean
}

const MAX_STALE_CONTINUATIONS = 3

/**
 * Check if active work has remaining tasks and return a continuation prompt.
 */
export function checkContinuation(options: WorkContinuationOptions): WorkContinuationResult {
  const { sessionId, directory, lastAssistantMessage } = options

  const state = readWorkState(directory)

  if (!state || state.paused) {
    return { continuationPrompt: null }
  }

  const progress = getPlanProgress(state.active_plan)

  if (progress.isComplete) {
    return {
      continuationPrompt: `✅ Plan **${state.plan_name}** is complete! All ${progress.total} tasks done.`,
      planComplete: true,
    }
  }

  // Detect stale continuations — if the last assistant message looks like a continuation
  // prompt was already injected, increment stale count
  const isStaleContinuation =
    lastAssistantMessage?.includes(state.active_plan) &&
    lastAssistantMessage?.includes("- [ ]")

  const completedSnapshot = state.continuation_completed_snapshot ?? 0
  const isNoProgress = progress.completed === completedSnapshot

  if (isStaleContinuation && isNoProgress) {
    const staleCount = (state.stale_continuation_count ?? 0) + 1
    if (staleCount >= MAX_STALE_CONTINUATIONS) {
      // Too many stale continuations — stop prompting
      writeWorkState(directory, { ...state, paused: true })
      return {
        continuationPrompt: `⚠️ Work on plan **${state.plan_name}** has been paused after ${staleCount} continuations with no progress. Resume manually with \`/implement ${state.plan_name}\`.`,
      }
    }
    writeWorkState(directory, {
      ...state,
      stale_continuation_count: staleCount,
      session_ids: state.session_ids.includes(sessionId)
        ? state.session_ids
        : [...state.session_ids, sessionId],
    })
  } else {
    // Progress was made — reset stale count and update snapshot
    writeWorkState(directory, {
      ...state,
      continuation_completed_snapshot: progress.completed,
      stale_continuation_count: 0,
      session_ids: state.session_ids.includes(sessionId)
        ? state.session_ids
        : [...state.session_ids, sessionId],
    })
  }

  const remaining = progress.total - progress.completed
  return {
    continuationPrompt: `Continue working on plan: **${state.plan_name}**

**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)
**Plan file**: \`${state.active_plan}\`

Read the plan file, find the next unchecked \`- [ ]\` task, and continue execution. Do not stop until all tasks are complete.`,
  }
}
