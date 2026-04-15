/**
 * First message variant.
 * Applies variant prompts to the first message in a session.
 * Ensures that special context is only injected once per session.
 */

/** Track which sessions have had the variant applied and which have been created */
const appliedSessions = new Set<string>()
const createdSessions = new Set<string>()

/**
 * Check if a variant prompt should be applied for this session and agent.
 * Returns true only on the first message in a new session.
 */
export function shouldApplyVariant(sessionId: string, _agentName?: string): boolean {
  return createdSessions.has(sessionId) && !appliedSessions.has(sessionId)
}

/** Mark that the variant has been applied for this session */
export function markApplied(sessionId: string): void {
  appliedSessions.add(sessionId)
}

/** Mark that a session has been created (becomes eligible for variant) */
export function markSessionCreated(sessionId: string): void {
  createdSessions.add(sessionId)
}

/** Clear tracking state for a session (e.g., when session ends) */
export function clearSession(sessionId: string): void {
  appliedSessions.delete(sessionId)
  createdSessions.delete(sessionId)
}

/** Get the current state of session tracking (for testing) */
export function getSessionState() {
  return {
    appliedSessions: new Set(appliedSessions),
    createdSessions: new Set(createdSessions),
  }
}

/** Reset all state (for testing) */
export function resetSessionState(): void {
  appliedSessions.clear()
  createdSessions.clear()
}
