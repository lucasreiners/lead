import {
  MAX_TRACKED_PATHS,
  MAX_TRACKED_SESSIONS,
  MAX_SUBAGENT_BUCKETS,
  MAX_LABEL_LENGTH,
} from "./constants"
import type { DelegationMetrics, ReadMetrics, SessionMetricsSnapshot } from "./types"

interface InternalSessionState {
  delegation: DelegationMetrics
  pathCounts: Map<string, number>
  readTotalCalls: number
  /** Reads of paths dropped after MAX_TRACKED_PATHS — not classifiable as unique or duplicate. */
  untrackedPathReads: number
  /** read/grep calls that carried no usable path argument — also unclassifiable. */
  pathlessReads: number
}

const sessions = new Map<string, InternalSessionState>()

function getOrCreateSession(sessionID: string): InternalSessionState {
  let state = sessions.get(sessionID)
  if (!state) {
    // Bound total tracked sessions: sessions are normally released on
    // session.idle, but abandoned sessions would otherwise accumulate.
    if (sessions.size >= MAX_TRACKED_SESSIONS) {
      const oldest = sessions.keys().next()
      if (!oldest.done) sessions.delete(oldest.value)
    }
    state = {
      // Null-prototype: `agent` is model-supplied and is used as a key.
      // A plain `{}` would make `"__proto__" in buckets` (and `toString`, etc.)
      // report true for inherited keys, so those counts would silently vanish.
      delegation: { totalCalls: 0, countBySubagent: Object.create(null) as Record<string, number>, resumedCalls: 0 },
      pathCounts: new Map(),
      readTotalCalls: 0,
      untrackedPathReads: 0,
      pathlessReads: 0,
    }
    sessions.set(sessionID, state)
  }
  return state
}

/**
 * Record a `subagent` tool invocation for delegation metrics.
 * Never throws — failures are swallowed so metrics collection can never
 * break a real tool call.
 */
export function recordDelegation(sessionID: string, args: Record<string, unknown>): void {
  try {
    const state = getOrCreateSession(sessionID)
    const raw = typeof args["agent"] === "string" ? (args["agent"] as string) : "unknown"
    // `agent` is model-supplied: truncate and bucket-limit it so a
    // misbehaving or hostile caller cannot grow this map without bound.
    const truncated = raw.slice(0, MAX_LABEL_LENGTH)
    const buckets = state.delegation.countBySubagent
    // Reserve one slot for the "other" bucket so the total never exceeds
    // MAX_SUBAGENT_BUCKETS. Existing keys always increment normally.
    // Use an own-property check, not `in` — see the null-prototype note above.
    const isExisting = Object.prototype.hasOwnProperty.call(buckets, truncated)
    const agent =
      isExisting || Object.keys(buckets).length < MAX_SUBAGENT_BUCKETS - 1 ? truncated : "other"
    const hasSessionID = typeof args["sessionID"] === "string" && args["sessionID"].length > 0

    state.delegation.totalCalls += 1
    state.delegation.countBySubagent[agent] = (state.delegation.countBySubagent[agent] ?? 0) + 1
    if (hasSessionID) {
      state.delegation.resumedCalls += 1
    }
  } catch {
    // Metrics collection must never break a tool call.
  }
}

/**
 * Record a `read` or `grep` tool invocation for read metrics.
 * Extracts the target path from args (`path` for both tools),
 * handling a missing path gracefully. Never throws.
 */
export function recordRead(sessionID: string, _tool: string, args: Record<string, unknown>): void {
  try {
    const state = getOrCreateSession(sessionID)
    state.readTotalCalls += 1

    const rawPath = args["path"]
    if (typeof rawPath !== "string" || rawPath.length === 0) {
      state.pathlessReads += 1
      return
    }

    const existing = state.pathCounts.get(rawPath)
    if (existing !== undefined) {
      state.pathCounts.set(rawPath, existing + 1)
      return
    }

    // Bound memory: stop tracking new distinct paths once we hit the cap.
    // Count these separately so `duplicateReads` is never silently wrong —
    // reads of untracked paths cannot be classified as unique or duplicate.
    if (state.pathCounts.size >= MAX_TRACKED_PATHS) {
      state.untrackedPathReads += 1
      return
    }
    state.pathCounts.set(rawPath, 1)
  } catch {
    // Metrics collection must never break a tool call.
  }
}

/**
 * Get a snapshot of the current metrics for a session, without clearing state.
 * Returns undefined if no metrics have been recorded for this session.
 */
export function peekSessionMetrics(sessionID: string): SessionMetricsSnapshot | undefined {
  const state = sessions.get(sessionID)
  if (!state) return undefined
  return buildSnapshot(sessionID, state)
}

/**
 * Get a snapshot of the current metrics for a session and drop its state,
 * so long-running processes do not leak memory across sessions.
 * Returns undefined if no metrics have been recorded for this session.
 */
export function takeSessionMetrics(sessionID: string): SessionMetricsSnapshot | undefined {
  const state = sessions.get(sessionID)
  if (!state) return undefined
  const snapshot = buildSnapshot(sessionID, state)
  sessions.delete(sessionID)
  return snapshot
}

function buildSnapshot(sessionID: string, state: InternalSessionState): SessionMetricsSnapshot {
  let duplicateReads = 0
  for (const count of state.pathCounts.values()) {
    if (count > 1) duplicateReads += count - 1
  }

  const reads: ReadMetrics = {
    totalCalls: state.readTotalCalls,
    distinctPaths: state.pathCounts.size,
    duplicateReads,
    untrackedPathReads: state.untrackedPathReads,
    pathlessReads: state.pathlessReads,
  }

  return {
    sessionID,
    delegation: { ...state.delegation, countBySubagent: { ...state.delegation.countBySubagent } },
    reads,
  }
}

/** Clear all tracked session state. Exposed for tests only. */
export function resetAllSessions(): void {
  sessions.clear()
}
