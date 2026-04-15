/**
 * Todo writer hook.
 * Intercepts todo write operations for state tracking and validation.
 */

import type { TodoItem } from "./todo-continuation-enforcer"
import { saveTodoStateForCompaction } from "./compaction-todo-preserver"

const TODO_WRITE_TOOL = "todowrite"

export interface TodoWriterHookInput {
  toolName: string
  args: Record<string, unknown>
  sessionId: string
}

export interface TodoWriterHookResult {
  /** Whether this was a todo write operation */
  captured: boolean
  /** The todo items that were written */
  todos?: TodoItem[]
}

/**
 * Intercept a tool call and capture todo state if it's a TodoWrite operation.
 */
export function captureToDoWrite(input: TodoWriterHookInput): TodoWriterHookResult {
  const { toolName, args, sessionId } = input

  if (toolName.toLowerCase() !== TODO_WRITE_TOOL.toLowerCase()) {
    return { captured: false }
  }

  // Extract todos from args
  const rawTodos = args["todos"]
  if (!Array.isArray(rawTodos)) {
    return { captured: false }
  }

  const todos: TodoItem[] = rawTodos
    .filter(
      (t): t is Record<string, unknown> => typeof t === "object" && t !== null,
    )
    .map((t) => ({
      content: String(t["content"] ?? ""),
      status: (t["status"] as TodoItem["status"]) ?? "pending",
      priority: (t["priority"] as TodoItem["priority"]) ?? "medium",
    }))

  // Save state for potential compaction recovery
  saveTodoStateForCompaction(sessionId, todos)

  return { captured: true, todos }
}
