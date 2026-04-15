/**
 * Todo description override.
 * Overrides the TodoWrite tool description with more specific guidance
 * for the executor agent's todo discipline.
 */

const TODO_WRITE_TOOL = "todowrite"

const ENHANCED_DESCRIPTION = `Manage the sidebar todo list. 

CRITICAL RULES:
- This tool performs a FULL ARRAY REPLACEMENT on every call
- ALWAYS include ALL current todos in EVERY call — never drop items
- Max 35 chars per todo content
- Mark tasks in_progress BEFORE starting, completed IMMEDIATELY after finishing
- NEVER batch completions — mark one at a time
- Status values: "pending", "in_progress", "completed", "cancelled"
- Priority values: "high", "medium", "low"
- Use format: "N/M: Task title" for numbered tasks
- ALWAYS issue a final todowrite before your last response marking all in_progress → completed`

/**
 * Apply todo description override for the TodoWrite tool.
 * Returns the modified description if applicable.
 */
export function applyTodoDescriptionOverride(
  toolName: string,
  originalDescription: string,
): string {
  if (toolName.toLowerCase() === TODO_WRITE_TOOL.toLowerCase()) {
    return ENHANCED_DESCRIPTION
  }
  return originalDescription
}
