/** Per-session delegation (task tool) metrics. */
export interface DelegationMetrics {
  totalCalls: number
  countBySubagent: Record<string, number>
  resumedCalls: number
}

/** Per-session read/grep metrics. */
export interface ReadMetrics {
  totalCalls: number
  distinctPaths: number
  duplicateReads: number
  /**
   * Reads of paths that were dropped after the per-session path cap was hit.
   * These cannot be classified as unique or duplicate, so `duplicateReads` is a
   * lower bound whenever this is non-zero.
   */
  untrackedPathReads: number
  /**
   * read/grep calls that carried no usable path argument. Also unclassifiable,
   * and likewise makes `duplicateReads` a lower bound.
   */
  pathlessReads: number
}

/** Combined per-session metrics snapshot. */
export interface SessionMetricsSnapshot {
  sessionID: string
  delegation: DelegationMetrics
  reads: ReadMetrics
}
