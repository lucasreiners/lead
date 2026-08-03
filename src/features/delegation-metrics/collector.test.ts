import { describe, it, expect, afterEach } from "bun:test"
import { recordDelegation, recordRead, peekSessionMetrics, takeSessionMetrics, resetAllSessions } from "./collector"
import { MAX_TRACKED_PATHS, MAX_TRACKED_SESSIONS, MAX_SUBAGENT_BUCKETS, MAX_LABEL_LENGTH } from "./constants"

describe("recordDelegation", () => {
  afterEach(() => resetAllSessions())

  it("counts total calls and per-subagent counts", () => {
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "engineer" })
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "engineer" })
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "reviewer" })

    const snapshot = peekSessionMetrics("s1")
    expect(snapshot).toBeDefined()
    expect(snapshot!.delegation.totalCalls).toBe(3)
    expect(snapshot!.delegation.countBySubagent).toEqual({ engineer: 2, reviewer: 1 })
  })

  it("counts resumed calls when task_id is supplied", () => {
    recordDelegation("s2", { description: "d", prompt: "p", subagent_type: "engineer" })
    recordDelegation("s2", { description: "d", prompt: "p", subagent_type: "engineer", task_id: "t1" })
    recordDelegation("s2", { description: "d", prompt: "p", subagent_type: "engineer", task_id: "t2" })

    const snapshot = peekSessionMetrics("s2")
    expect(snapshot!.delegation.resumedCalls).toBe(2)
    expect(snapshot!.delegation.totalCalls).toBe(3)
  })

  it("falls back to 'unknown' when subagent_type is missing or not a string", () => {
    recordDelegation("s3", { description: "d", prompt: "p", subagent_type: 123 as unknown as string })
    const snapshot = peekSessionMetrics("s3")
    expect(snapshot!.delegation.countBySubagent).toEqual({ unknown: 1 })
  })

  it("keeps sessions isolated from each other", () => {
    recordDelegation("s4", { description: "d", prompt: "p", subagent_type: "engineer" })
    recordDelegation("s5", { description: "d", prompt: "p", subagent_type: "reviewer" })

    expect(peekSessionMetrics("s4")!.delegation.totalCalls).toBe(1)
    expect(peekSessionMetrics("s5")!.delegation.totalCalls).toBe(1)
    expect(peekSessionMetrics("s4")!.delegation.countBySubagent).toEqual({ engineer: 1 })
  })
})

describe("recordRead", () => {
  afterEach(() => resetAllSessions())

  it("extracts filePath for read tool", () => {
    recordRead("s1", "read", { filePath: "/a.ts" })
    recordRead("s1", "read", { filePath: "/b.ts" })
    recordRead("s1", "read", { filePath: "/a.ts" })

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.reads.totalCalls).toBe(3)
    expect(snapshot.reads.distinctPaths).toBe(2)
    expect(snapshot.reads.duplicateReads).toBe(1)
  })

  it("extracts path for grep tool", () => {
    recordRead("s2", "grep", { path: "/src", pattern: "foo" })
    recordRead("s2", "grep", { path: "/src", pattern: "bar" })

    const snapshot = peekSessionMetrics("s2")!
    expect(snapshot.reads.totalCalls).toBe(2)
    expect(snapshot.reads.distinctPaths).toBe(1)
    expect(snapshot.reads.duplicateReads).toBe(1)
  })

  it("handles a missing path gracefully for grep", () => {
    recordRead("s3", "grep", { pattern: "foo" })
    recordRead("s3", "grep", { pattern: "bar" })

    const snapshot = peekSessionMetrics("s3")!
    expect(snapshot.reads.totalCalls).toBe(2)
    expect(snapshot.reads.distinctPaths).toBe(0)
    expect(snapshot.reads.duplicateReads).toBe(0)
  })

  it("caps the number of distinct tracked paths", () => {
    for (let i = 0; i < MAX_TRACKED_PATHS + 10; i++) {
      recordRead("s4", "read", { filePath: `/file-${i}.ts` })
    }

    const snapshot = peekSessionMetrics("s4")!
    expect(snapshot.reads.totalCalls).toBe(MAX_TRACKED_PATHS + 10)
    expect(snapshot.reads.distinctPaths).toBeLessThanOrEqual(MAX_TRACKED_PATHS)
  })
})

describe("peekSessionMetrics / takeSessionMetrics", () => {
  afterEach(() => resetAllSessions())

  it("returns undefined for unknown sessions", () => {
    expect(peekSessionMetrics("nope")).toBeUndefined()
    expect(takeSessionMetrics("nope")).toBeUndefined()
  })

  it("peek does not clear state, take does", () => {
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "engineer" })

    expect(peekSessionMetrics("s1")).toBeDefined()
    expect(peekSessionMetrics("s1")).toBeDefined() // still there

    const taken = takeSessionMetrics("s1")
    expect(taken).toBeDefined()
    expect(peekSessionMetrics("s1")).toBeUndefined() // cleared after take
    expect(takeSessionMetrics("s1")).toBeUndefined()
  })

  it("does not mutate internal state through the returned snapshot", () => {
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "engineer" })
    const snapshot = peekSessionMetrics("s1")!
    snapshot.delegation.countBySubagent["engineer"] = 999

    const second = peekSessionMetrics("s1")!
    expect(second.delegation.countBySubagent["engineer"]).toBe(1)
  })
})

describe("session eviction cap", () => {
  afterEach(() => resetAllSessions())

  it("evicts the oldest session once MAX_TRACKED_SESSIONS is reached", () => {
    for (let i = 0; i < MAX_TRACKED_SESSIONS + 5; i++) {
      recordDelegation(`session-${i}`, { description: "d", prompt: "p", subagent_type: "engineer" })
    }

    // The oldest sessions should have been evicted.
    expect(peekSessionMetrics("session-0")).toBeUndefined()
    expect(peekSessionMetrics("session-4")).toBeUndefined()

    // The newest session should still be present.
    const last = MAX_TRACKED_SESSIONS + 4
    expect(peekSessionMetrics(`session-${last}`)).toBeDefined()

    // Total tracked sessions must never exceed the cap.
    let trackedCount = 0
    for (let i = 0; i < MAX_TRACKED_SESSIONS + 5; i++) {
      if (peekSessionMetrics(`session-${i}`) !== undefined) trackedCount += 1
    }
    expect(trackedCount).toBeLessThanOrEqual(MAX_TRACKED_SESSIONS)
  })
})

describe("subagent_type label truncation", () => {
  afterEach(() => resetAllSessions())

  it("truncates an over-long subagent_type to MAX_LABEL_LENGTH", () => {
    const longType = "x".repeat(MAX_LABEL_LENGTH + 20)
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: longType })

    const snapshot = peekSessionMetrics("s1")!
    const keys = Object.keys(snapshot.delegation.countBySubagent)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toHaveLength(MAX_LABEL_LENGTH)
    expect(keys[0]).toBe(longType.slice(0, MAX_LABEL_LENGTH))
  })
})

describe("subagent bucket overflow", () => {
  afterEach(() => resetAllSessions())

  it("folds new distinct subagent_types into 'other' once the bucket cap is hit, without exceeding MAX_SUBAGENT_BUCKETS", () => {
    // Fill up to MAX_SUBAGENT_BUCKETS - 1 distinct named buckets.
    for (let i = 0; i < MAX_SUBAGENT_BUCKETS - 1; i++) {
      recordDelegation("s1", { description: "d", prompt: "p", subagent_type: `type-${i}` })
    }

    let snapshot = peekSessionMetrics("s1")!
    expect(Object.keys(snapshot.delegation.countBySubagent)).toHaveLength(MAX_SUBAGENT_BUCKETS - 1)

    // Any new distinct type should now be folded into "other".
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "brand-new-type" })
    snapshot = peekSessionMetrics("s1")!
    expect(snapshot.delegation.countBySubagent["other"]).toBe(1)
    expect(snapshot.delegation.countBySubagent["brand-new-type"]).toBeUndefined()

    // Another distinct type also folds into "other", not a new bucket.
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "another-new-type" })
    snapshot = peekSessionMetrics("s1")!
    expect(snapshot.delegation.countBySubagent["other"]).toBe(2)

    // Total number of keys must never exceed MAX_SUBAGENT_BUCKETS.
    expect(Object.keys(snapshot.delegation.countBySubagent).length).toBeLessThanOrEqual(MAX_SUBAGENT_BUCKETS)
  })

  it("still increments an existing bucket normally after the cap is reached", () => {
    for (let i = 0; i < MAX_SUBAGENT_BUCKETS - 1; i++) {
      recordDelegation("s1", { description: "d", prompt: "p", subagent_type: `type-${i}` })
    }
    // Push past the cap with new distinct types (folded into "other").
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "overflow-1" })
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "overflow-2" })

    // A pre-existing type (recorded before the cap was hit) still increments its own bucket.
    recordDelegation("s1", { description: "d", prompt: "p", subagent_type: "type-0" })

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.delegation.countBySubagent["type-0"]).toBe(2)
    expect(snapshot.delegation.countBySubagent["other"]).toBe(2)
    expect(Object.keys(snapshot.delegation.countBySubagent).length).toBeLessThanOrEqual(MAX_SUBAGENT_BUCKETS)
  })
})

describe("untrackedPathReads", () => {
  afterEach(() => resetAllSessions())

  it("is 0 when distinct paths stay under the cap", () => {
    recordRead("s1", "read", { filePath: "/a.ts" })
    recordRead("s1", "read", { filePath: "/b.ts" })
    recordRead("s1", "read", { filePath: "/a.ts" })

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.reads.untrackedPathReads).toBe(0)
    expect(snapshot.reads.duplicateReads).toBe(1)
  })

  it("becomes non-zero once distinct paths exceed MAX_TRACKED_PATHS, while duplicateReads stays correct", () => {
    // Fill up to the cap with distinct paths.
    for (let i = 0; i < MAX_TRACKED_PATHS; i++) {
      recordRead("s1", "read", { filePath: `/file-${i}.ts` })
    }
    // These new distinct paths exceed the cap and are not tracked.
    recordRead("s1", "read", { filePath: "/overflow-1.ts" })
    recordRead("s1", "read", { filePath: "/overflow-2.ts" })
    recordRead("s1", "read", { filePath: "/overflow-3.ts" })

    // Duplicate reads of an already-tracked path still count correctly.
    recordRead("s1", "read", { filePath: "/file-0.ts" })

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.reads.distinctPaths).toBe(MAX_TRACKED_PATHS)
    expect(snapshot.reads.untrackedPathReads).toBe(3)
    expect(snapshot.reads.duplicateReads).toBe(1)
    expect(snapshot.reads.totalCalls).toBe(MAX_TRACKED_PATHS + 4)
  })
})

describe("collector — hostile key handling", () => {
  afterEach(() => resetAllSessions())

  it("counts prototype-shadowing subagent_type values as real buckets", () => {
    // A plain `{}` would make `"__proto__" in buckets` true via the prototype
    // chain, so these increments would silently vanish.
    for (const name of ["__proto__", "constructor", "toString"]) {
      recordDelegation("s1", { description: "d", prompt: "p", subagent_type: name })
    }

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.delegation.totalCalls).toBe(3)
    expect(snapshot.delegation.countBySubagent["__proto__"]).toBe(1)
    expect(snapshot.delegation.countBySubagent["constructor"]).toBe(1)
    expect(snapshot.delegation.countBySubagent["toString"]).toBe(1)
  })

  it("keeps bucket totals consistent with totalCalls", () => {
    for (const name of ["__proto__", "engineer", "engineer", "toString"]) {
      recordDelegation("s1", { description: "d", prompt: "p", subagent_type: name })
    }
    const snapshot = peekSessionMetrics("s1")!
    const summed = Object.values(snapshot.delegation.countBySubagent).reduce((a, b) => a + b, 0)
    expect(summed).toBe(snapshot.delegation.totalCalls)
  })
})

describe("recordRead — pathless calls", () => {
  afterEach(() => resetAllSessions())

  it("counts read/grep calls with no usable path separately", () => {
    recordRead("s1", "grep", { pattern: "x" })
    recordRead("s1", "read", { filePath: "" })
    recordRead("s1", "read", { filePath: "/a.ts" })

    const snapshot = peekSessionMetrics("s1")!
    expect(snapshot.reads.totalCalls).toBe(3)
    expect(snapshot.reads.pathlessReads).toBe(2)
    expect(snapshot.reads.distinctPaths).toBe(1)
    expect(snapshot.reads.duplicateReads).toBe(0)
  })
})
