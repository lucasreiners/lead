import { readWorkState, getPlanProgress } from "../features/work-state/storage"
import { loadActiveInstance } from "../features/workflow/storage"

/**
 * Compaction recovery hook.
 * After context compaction, injects a recovery prompt with active work context.
 * This ensures the agent doesn't lose track of ongoing work.
 */

export interface CompactionRecoveryOptions {
  /** Current session ID */
  sessionId: string
  /** Working directory */
  directory: string
}

export interface CompactionRecoveryResult {
  /** Recovery prompt to inject, or null if no active work */
  recoveryPrompt: string | null
}

/**
 * Build a recovery prompt after context compaction.
 * Summarizes the current work state so the agent knows what it was doing.
 */
export function checkCompactionRecovery(
  options: CompactionRecoveryOptions,
): CompactionRecoveryResult {
  const { directory } = options

  const parts: string[] = []

  // Check for active plan
  const workState = readWorkState(directory)
  if (workState && !workState.paused) {
    const progress = getPlanProgress(workState.active_plan)
    if (!progress.isComplete) {
      parts.push(
        `## Active Plan: ${workState.plan_name}

**File**: \`${workState.active_plan}\`
**Progress**: ${progress.completed}/${progress.total} tasks complete

You were executing this plan. Read the plan file to find the next unchecked \`- [ ]\` task and continue execution.`,
      )
    }
  }

  // Check for active workflow
  const workflowInstance = loadActiveInstance(directory)
  if (workflowInstance && workflowInstance.status === "running") {
    parts.push(
      `## Active Workflow: ${workflowInstance.definition_name}

**Instance**: ${workflowInstance.instance_id}
**Goal**: ${workflowInstance.goal}
**Current Step**: ${workflowInstance.current_step_id}

You were executing a workflow. Continue from the current step.`,
    )
  }

  if (parts.length === 0) {
    return { recoveryPrompt: null }
  }

  const recoveryPrompt = `# Context Recovery After Compaction

Your context was compacted. Here is a summary of your active work:

${parts.join("\n\n---\n\n")}

Resume where you left off.`

  return { recoveryPrompt }
}
