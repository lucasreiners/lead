/**
 * Todo continuation enforcer.
 * Detects stale in_progress todos and prompts the agent to complete or update them.
 */

export interface TodoItem {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority: "high" | "medium" | "low"
}

export interface TodoContinuationResult {
  /** Whether stale in_progress todos were detected */
  hasStale: boolean
  /** Prompt to inject if stale todos detected */
  prompt: string | null
  /** The stale todos that were found */
  staleTodos: TodoItem[]
}

/**
 * Check for stale in_progress todos and return a prompt if found.
 * A stale todo is one that has been in_progress but the agent hasn't completed it.
 */
export function checkStaleTodos(todos: TodoItem[]): TodoContinuationResult {
  const staleTodos = todos.filter((t) => t.status === "in_progress")

  if (staleTodos.length === 0) {
    return { hasStale: false, prompt: null, staleTodos: [] }
  }

  const staleList = staleTodos.map((t) => `- "${t.content}"`).join("\n")

  return {
    hasStale: true,
    staleTodos,
    prompt: `You have ${staleTodos.length} in_progress todo(s) that appear stale:

${staleList}

Please either:
1. Complete the tasks and mark them "completed"
2. Update the todos with current status using the todowrite tool
3. Mark them "cancelled" if they are no longer needed

Never leave in_progress items unattended — they are tracked as work in progress.`,
  }
}
