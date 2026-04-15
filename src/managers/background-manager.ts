/**
 * BackgroundManager.
 * Manages background task spawning with concurrency control.
 * v0.1: In-memory tracking only — real session spawning is deferred.
 */

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface SpawnOptions {
  agentName: string
  prompt: string
  category?: string
  skills?: string[]
  concurrencyKey?: string
}

export interface TaskRecord {
  id: string
  status: TaskStatus
  options: SpawnOptions
  result?: unknown
  error?: string
  startedAt?: Date
  completedAt?: Date
}

let taskCounter = 0

function generateTaskId(): string {
  taskCounter++
  return `task-${Date.now()}-${taskCounter}`
}

export class BackgroundManager {
  private readonly tasks = new Map<string, TaskRecord>()
  readonly maxConcurrent: number

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
  }

  /**
   * Spawn a new background task.
   * Returns the task ID. v0.1: Creates record only, does not execute.
   */
  spawn(options: SpawnOptions): string {
    const id = generateTaskId()
    const record: TaskRecord = {
      id,
      status: this.getRunningCount() < this.maxConcurrent ? "running" : "pending",
      options,
      startedAt: new Date(),
    }
    this.tasks.set(id, record)
    return id
  }

  /** Get a task record by ID */
  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId)
  }

  /** Cancel a task */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status === "completed" || task.status === "failed") {
      return false
    }
    task.status = "cancelled"
    task.completedAt = new Date()
    return true
  }

  /** Cancel all pending/running tasks */
  cancelAll(): void {
    for (const task of this.tasks.values()) {
      if (task.status === "pending" || task.status === "running") {
        task.status = "cancelled"
        task.completedAt = new Date()
      }
    }
  }

  /** List tasks, optionally filtered by status */
  list(filter?: { status?: TaskStatus }): TaskRecord[] {
    const all = Array.from(this.tasks.values())
    if (!filter?.status) return all
    return all.filter((t) => t.status === filter.status)
  }

  /** Count currently running tasks */
  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter((t) => t.status === "running").length
  }

  /** Mark a task as completed with a result */
  complete(taskId: string, result?: unknown): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== "running") return false
    task.status = "completed"
    task.result = result
    task.completedAt = new Date()
    return true
  }

  /** Mark a task as failed with an error */
  fail(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== "running") return false
    task.status = "failed"
    task.error = error
    task.completedAt = new Date()
    return true
  }
}
