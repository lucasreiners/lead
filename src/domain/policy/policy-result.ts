/**
 * Policy result types for the L.E.A.D. policy engine.
 * Policies are evaluated at lifecycle hooks (chat, tool, session).
 * Deny wins over allow when merging multiple policy results.
 */

export type PolicyVerdict = "allow" | "deny"

export interface PolicyResult {
  /** Whether this policy allows or denies the action */
  verdict: PolicyVerdict
  /** Optional reason explaining the verdict */
  reason?: string
  /** Optional metadata for downstream handling */
  metadata?: Record<string, unknown>
}

/**
 * Merge multiple policy results.
 * Deny wins over allow — if any policy denies, the merged result is deny.
 */
export function mergePolicyResults(results: PolicyResult[]): PolicyResult {
  if (results.length === 0) {
    return { verdict: "allow" }
  }

  const denials = results.filter((r) => r.verdict === "deny")
  if (denials.length > 0) {
    const reasons = denials
      .map((r) => r.reason)
      .filter(Boolean)
      .join("; ")
    return {
      verdict: "deny",
      reason: reasons || "Policy denied",
      metadata: denials[0]?.metadata,
    }
  }

  const allows = results.filter((r) => r.verdict === "allow")
  const reasons = allows
    .map((r) => r.reason)
    .filter(Boolean)
    .join("; ")
  return {
    verdict: "allow",
    reason: reasons || undefined,
  }
}

/** Convenience factory — creates an allow result */
export function allow(reason?: string): PolicyResult {
  return { verdict: "allow", reason }
}

/** Convenience factory — creates a deny result */
export function deny(reason: string, metadata?: Record<string, unknown>): PolicyResult {
  return { verdict: "deny", reason, metadata }
}
