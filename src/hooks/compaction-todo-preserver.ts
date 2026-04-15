/**
 * Compaction todo preserver.
 * During session compaction, preserves active todo state so it isn't lost.
 */

import type { TodoItem } from "./todo-continuation-enforcer"

/** In-memory store of todo state per session */
const todoStateStore = new Map<string, TodoItem[]>()

/**
 * Save the current todo state for a session before compaction.
 */
export function saveTodoStateForCompaction(sessionId: string, todos: TodoItem[]): void {
  todoStateStore.set(sessionId, [...todos])
}

/**
 * Get the preserved todo state for a session after compaction.
 */
export function getPreservedTodoState(sessionId: string): TodoItem[] | null {
  return todoStateStore.get(sessionId) ?? null
}

/**
 * Clear the preserved todo state for a session.
 */
export function clearPreservedTodoState(sessionId: string): void {
  todoStateStore.delete(sessionId)
}

/**
 * Build a prompt that reminds the agent of its preserved todo state after compaction.
 */
export function buildTodoPreservationPrompt(sessionId: string): string | null {
  const todos = getPreservedTodoState(sessionId)
  if (!todos || todos.length === 0) return null

  const inProgress = todos.filter((t) => t.status === "in_progress")
  const pending = todos.filter((t) => t.status === "pending")

  if (inProgress.length === 0 && pending.length === 0) return null

  const parts: string[] = ["## Preserved Todo State (Before Compaction)"]

  if (inProgress.length > 0) {
    parts.push(
      `**In Progress** (${inProgress.length}):\n${inProgress.map((t) => `- ${t.content}`).join("\n")}`,
    )
  }

  if (pending.length > 0) {
    parts.push(
      `**Pending** (${pending.length}):\n${pending.map((t) => `- ${t.content}`).join("\n")}`,
    )
  }

  parts.push("Restore this todo state using the todowrite tool before continuing.")

  return parts.join("\n\n")
}
