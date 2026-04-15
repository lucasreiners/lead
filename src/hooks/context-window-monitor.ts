/**
 * Context window monitor.
 * Warns when token usage approaches model context limits.
 */

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  contextWindow: number
}

export type ContextWindowSeverity = "ok" | "warning" | "critical"

export interface ContextWindowCheckResult {
  severity: ContextWindowSeverity
  usagePercent: number
  message?: string
}

export interface ContextWindowThresholds {
  /** Percentage at which to warn (default 0.75) */
  warningPercent?: number
  /** Percentage at which to issue critical warning (default 0.9) */
  criticalPercent?: number
}

const DEFAULT_WARNING = 0.75
const DEFAULT_CRITICAL = 0.9

/**
 * Check if token usage is approaching context window limits.
 * Returns severity and an optional warning message.
 */
export function checkContextWindow(
  usage: TokenUsage,
  thresholds: ContextWindowThresholds = {},
): ContextWindowCheckResult {
  const warningPercent = thresholds.warningPercent ?? DEFAULT_WARNING
  const criticalPercent = thresholds.criticalPercent ?? DEFAULT_CRITICAL

  if (usage.contextWindow <= 0) {
    return { severity: "ok", usagePercent: 0 }
  }

  const totalUsed = usage.inputTokens + usage.outputTokens
  const usagePercent = totalUsed / usage.contextWindow

  if (usagePercent >= criticalPercent) {
    return {
      severity: "critical",
      usagePercent,
      message: `⚠️ Critical: Context window ${Math.round(usagePercent * 100)}% full (${totalUsed.toLocaleString()}/${usage.contextWindow.toLocaleString()} tokens). Compact context soon to avoid truncation.`,
    }
  }

  if (usagePercent >= warningPercent) {
    return {
      severity: "warning",
      usagePercent,
      message: `ℹ️ Context window ${Math.round(usagePercent * 100)}% full (${totalUsed.toLocaleString()}/${usage.contextWindow.toLocaleString()} tokens). Consider compacting context.`,
    }
  }

  return { severity: "ok", usagePercent }
}
