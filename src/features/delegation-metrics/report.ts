import type { SessionMetricsSnapshot } from "./types"

/**
 * Format a short, human-readable summary of a session's delegation and
 * read metrics for logging.
 */
export function formatMetricsReport(snapshot: SessionMetricsSnapshot): string {
  const { sessionID, delegation, reads } = snapshot

  const reuseRate = delegation.totalCalls > 0 ? delegation.resumedCalls / delegation.totalCalls : 0

  const bySubagent = Object.entries(delegation.countBySubagent)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ")

  const delegationPart =
    `delegation: total=${delegation.totalCalls} resumed=${delegation.resumedCalls} ` +
    `reuseRate=${(reuseRate * 100).toFixed(0)}%` +
    (bySubagent ? ` bySubagent={${bySubagent}}` : "")

  const unclassified = reads.untrackedPathReads + reads.pathlessReads
  const readsPart =
    `reads: total=${reads.totalCalls} distinctPaths=${reads.distinctPaths} duplicateReads=${reads.duplicateReads}${
      unclassified > 0
        ? ` (lower bound: ${unclassified} read(s) unclassified — may include duplicates)`
        : ""
    }`

  return `[delegation-metrics] session=${sessionID.slice(0, 8)}… ${delegationPart} | ${readsPart}`
}
