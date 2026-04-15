import { describe, it, expect, beforeEach } from "bun:test"
import { BackgroundManager } from "./background-manager"

describe("BackgroundManager", () => {
  let manager: BackgroundManager

  beforeEach(() => {
    manager = new BackgroundManager(2) // max 2 concurrent
  })

  it("spawns a task and returns an ID", () => {
    const id = manager.spawn({
      agentName: "engineer",
      prompt: "do something",
    })
    expect(typeof id).toBe("string")
    expect(id.startsWith("task-")).toBe(true)
  })

  it("respects max concurrency", () => {
    const id1 = manager.spawn({ agentName: "engineer", prompt: "task1" })
    const id2 = manager.spawn({ agentName: "engineer", prompt: "task2" })
    const id3 = manager.spawn({ agentName: "engineer", prompt: "task3" }) // should be pending

    expect(manager.getTask(id1)?.status).toBe("running")
    expect(manager.getTask(id2)?.status).toBe("running")
    expect(manager.getTask(id3)?.status).toBe("pending")
  })

  it("cancels a running task", () => {
    const id = manager.spawn({ agentName: "engineer", prompt: "task" })
    const cancelled = manager.cancel(id)
    expect(cancelled).toBe(true)
    expect(manager.getTask(id)?.status).toBe("cancelled")
  })

  it("cancelAll cancels all pending/running tasks", () => {
    manager.spawn({ agentName: "engineer", prompt: "task1" })
    manager.spawn({ agentName: "engineer", prompt: "task2" })
    manager.cancelAll()

    const all = manager.list()
    for (const task of all) {
      expect(task.status).toBe("cancelled")
    }
  })

  it("lists tasks filtered by status", () => {
    const id1 = manager.spawn({ agentName: "engineer", prompt: "task1" })
    manager.complete(id1, "done")
    manager.spawn({ agentName: "engineer", prompt: "task2" })

    const completed = manager.list({ status: "completed" })
    const running = manager.list({ status: "running" })

    expect(completed).toHaveLength(1)
    expect(running).toHaveLength(1)
  })

  it("getRunningCount returns correct count", () => {
    manager.spawn({ agentName: "engineer", prompt: "task1" })
    manager.spawn({ agentName: "engineer", prompt: "task2" })
    expect(manager.getRunningCount()).toBe(2)
  })
})
