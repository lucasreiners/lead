/**
 * Session token state tracker.
 * Tracks token usage per session for context window monitoring.
 */

export interface TokenStateEntry {
  sessionId: string
  inputTokens: number
  outputTokens: number
  contextWindow: number
  lastUpdatedAt: Date
}

/** In-memory token state store */
const tokenStateStore = new Map<string, TokenStateEntry>()

/**
 * Update token usage for a session.
 */
export function updateTokenState(
  sessionId: string,
  delta: {
    inputTokens?: number
    outputTokens?: number
    contextWindow?: number
  },
): TokenStateEntry {
  const existing = tokenStateStore.get(sessionId) ?? {
    sessionId,
    inputTokens: 0,
    outputTokens: 0,
    contextWindow: 0,
    lastUpdatedAt: new Date(),
  }

  const updated: TokenStateEntry = {
    ...existing,
    inputTokens: existing.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: existing.outputTokens + (delta.outputTokens ?? 0),
    contextWindow: delta.contextWindow ?? existing.contextWindow,
    lastUpdatedAt: new Date(),
  }

  tokenStateStore.set(sessionId, updated)
  return updated
}

/**
 * Get current token state for a session.
 */
export function getTokenState(sessionId: string): TokenStateEntry | null {
  return tokenStateStore.get(sessionId) ?? null
}

/**
 * Reset token state for a session.
 */
export function resetTokenState(sessionId: string): void {
  tokenStateStore.delete(sessionId)
}

/**
 * Get all tracked sessions.
 */
export function getAllTokenStates(): TokenStateEntry[] {
  return Array.from(tokenStateStore.values())
}
