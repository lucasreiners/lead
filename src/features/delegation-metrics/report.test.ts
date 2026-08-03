import { describe, it, expect } from "bun:test"
import { formatMetricsReport } from "./report"
import type { SessionMetricsSnapshot } from "./types"

describe("formatMetricsReport", () => {
  it("includes session id, delegation, and read metrics", () => {
    const snapshot: SessionMetricsSnapshot = {
      sessionID: "session-abc",
      delegation: {
        totalCalls: 4,
        countBySubagent: { engineer: 3, reviewer: 1 },
        resumedCalls: 2,
      },
      reads: {
        totalCalls: 10,
        distinctPaths: 6,
        duplicateReads: 4,
        untrackedPathReads: 0,
        pathlessReads: 0,
      },
    }

    const report = formatMetricsReport(snapshot)

    expect(report).toContain("session=session-…")
    expect(report).not.toContain("session-abc")
    expect(report).toContain("total=4")
    expect(report).toContain("resumed=2")
    expect(report).toContain("reuseRate=50%")
    expect(report).toContain("engineer=3")
    expect(report).toContain("reviewer=1")
    expect(report).toContain("distinctPaths=6")
    expect(report).toContain("duplicateReads=4")
  })

  it("handles zero delegation calls without dividing by zero", () => {
    const snapshot: SessionMetricsSnapshot = {
      sessionID: "session-empty",
      delegation: { totalCalls: 0, countBySubagent: {}, resumedCalls: 0 },
      reads: { totalCalls: 0, distinctPaths: 0, duplicateReads: 0 },
    }

    const report = formatMetricsReport(snapshot)
    expect(report).toContain("reuseRate=0%")
    expect(report).not.toContain("bySubagent")
  })
})

describe("formatMetricsReport — unclassified reads", () => {
  const base = (reads: Partial<SessionMetricsSnapshot["reads"]>): SessionMetricsSnapshot => ({
    sessionID: "session-abc",
    delegation: { totalCalls: 1, countBySubagent: { engineer: 1 }, resumedCalls: 0 },
    reads: {
      totalCalls: 5,
      distinctPaths: 3,
      duplicateReads: 2,
      untrackedPathReads: 0,
      pathlessReads: 0,
      ...reads,
    },
  })

  it("omits the lower-bound notice when everything is classified", () => {
    expect(formatMetricsReport(base({}))).not.toContain("lower bound")
  })

  it("discloses duplicateReads is a lower bound when paths were dropped", () => {
    const report = formatMetricsReport(base({ untrackedPathReads: 7 }))
    expect(report).toContain("lower bound")
    expect(report).toContain("7 read(s) unclassified")
    expect(report).toContain("may include duplicates")
  })

  it("counts pathless reads toward the unclassified total", () => {
    const report = formatMetricsReport(base({ untrackedPathReads: 2, pathlessReads: 3 }))
    expect(report).toContain("5 read(s) unclassified")
  })
})
