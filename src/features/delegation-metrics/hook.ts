import { recordDelegation, recordRead, takeSessionMetrics } from "./collector"
import { formatMetricsReport } from "./report"
import { METRICS_ENV_VAR } from "./constants"
import { debug } from "../../shared/log"

/**
 * Capture a `tool.execute.before` invocation for delegation/read metrics.
 * No-op for tools other than `task`, `read`, `grep`. Never throws.
 *
 * Collection is fully disabled unless `LEAD_METRICS` is set, so the default
 * path allocates nothing and retains no per-session state.
 */
export function captureToolMetrics(params: { toolName: string; sessionId: string; args: Record<string, unknown> }): void {
  const { toolName, sessionId, args } = params
  try {
    if (!process.env[METRICS_ENV_VAR]) return
    if (toolName === "task") {
      recordDelegation(sessionId, args)
      return
    }
    if (toolName === "read" || toolName === "grep") {
      recordRead(sessionId, toolName, args)
    }
  } catch {
    // Metrics collection must never break a tool call.
  }
}

/**
 * Report and clear metrics for a session on `session.idle`.
 * Logging is silent by default and only emitted when the
 * `LEAD_METRICS` env var is set to a truthy value, but session state is
 * always dropped to bound memory regardless of the env var.
 */
export function reportAndClearSessionMetrics(sessionId: string): void {
  try {
    const snapshot = takeSessionMetrics(sessionId)
    if (!snapshot) return

    if (process.env[METRICS_ENV_VAR]) {
      debug("delegation-metrics", formatMetricsReport(snapshot))
    }
  } catch {
    // Metrics collection must never break session handling.
  }
}
