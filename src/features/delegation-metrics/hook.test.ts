import { describe, it, expect, afterEach, beforeEach } from "bun:test"
import { captureToolMetrics, reportAndClearSessionMetrics } from "./hook"
import { peekSessionMetrics, resetAllSessions } from "./collector"
import { METRICS_ENV_VAR } from "./constants"

describe("captureToolMetrics", () => {
  const originalEnv = process.env[METRICS_ENV_VAR]

  beforeEach(() => {
    process.env[METRICS_ENV_VAR] = "1"
  })

  afterEach(() => {
    resetAllSessions()
    if (originalEnv === undefined) {
      delete process.env[METRICS_ENV_VAR]
    } else {
      process.env[METRICS_ENV_VAR] = originalEnv
    }
  })

  it("collects nothing when LEAD_METRICS is unset", () => {
    delete process.env[METRICS_ENV_VAR]
    captureToolMetrics({
      toolName: "task",
      sessionId: "s1",
      args: { description: "d", prompt: "p", subagent_type: "engineer" },
    })
    captureToolMetrics({ toolName: "read", sessionId: "s1", args: { filePath: "/a.ts" } })
    expect(peekSessionMetrics("s1")).toBeUndefined()
  })

  it("records task tool calls as delegation metrics", () => {
    captureToolMetrics({
      toolName: "task",
      sessionId: "s1",
      args: { description: "d", prompt: "p", subagent_type: "engineer" },
    })

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.delegation.totalCalls).toBe(1)
  })

  it("records read tool calls as read metrics", () => {
    captureToolMetrics({ toolName: "read", sessionId: "s1", args: { filePath: "/a.ts" } })
    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.reads.totalCalls).toBe(1)
  })

  it("records grep tool calls as read metrics", () => {
    captureToolMetrics({ toolName: "grep", sessionId: "s1", args: { path: "/src", pattern: "x" } })
    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.reads.totalCalls).toBe(1)
  })

  it("ignores unrelated tools", () => {
    captureToolMetrics({ toolName: "write", sessionId: "s1", args: { filePath: "/a.ts" } })
    expect(peekSessionMetrics("s1")).toBeUndefined()
  })

  it("never throws on malformed args", () => {
    expect(() =>
      captureToolMetrics({ toolName: "task", sessionId: "s1", args: null as unknown as Record<string, unknown> }),
    ).not.toThrow()
  })
})

describe("reportAndClearSessionMetrics", () => {
  const originalEnv = process.env[METRICS_ENV_VAR]

  beforeEach(() => {
    delete process.env[METRICS_ENV_VAR]
  })

  afterEach(() => {
    resetAllSessions()
    if (originalEnv === undefined) {
      delete process.env[METRICS_ENV_VAR]
    } else {
      process.env[METRICS_ENV_VAR] = originalEnv
    }
  })

  it("clears session state once reported", () => {
    process.env[METRICS_ENV_VAR] = "1"
    captureToolMetrics({
      toolName: "task",
      sessionId: "s1",
      args: { description: "d", prompt: "p", subagent_type: "engineer" },
    })
    expect(peekSessionMetrics("s1")).toBeDefined()

    reportAndClearSessionMetrics("s1")
    expect(peekSessionMetrics("s1")).toBeUndefined()
  })

  it("is a no-op for sessions with no recorded metrics", () => {
    expect(() => reportAndClearSessionMetrics("unknown-session")).not.toThrow()
  })

  it("does not throw when LEAD_METRICS is enabled", () => {
    process.env[METRICS_ENV_VAR] = "1"
    captureToolMetrics({
      toolName: "task",
      sessionId: "s1",
      args: { description: "d", prompt: "p", subagent_type: "engineer" },
    })
    expect(() => reportAndClearSessionMetrics("s1")).not.toThrow()
  })
})
