import { checkContextWindow } from "./context-window-monitor"
import { createWriteGuard } from "./write-existing-file-guard"
import {
  shouldApplyVariant,
  markApplied,
  markSessionCreated,
  clearSession,
} from "./first-message-variant"
import { processMessageForKeywords } from "./keyword-detector"
import { checkArchitectWrite } from "./architect-md-only"
import { handleStartImplementation } from "./start-implementation-hook"
import { checkContinuation } from "./work-continuation"
import { checkCompactionRecovery } from "./compaction-recovery"
import { buildVerificationReminder } from "./verification-reminder"
import { applyTodoDescriptionOverride } from "./todo-description-override"
import { checkStaleTodos } from "./todo-continuation-enforcer"
import {
  buildTodoPreservationPrompt,
} from "./compaction-todo-preserver"
import { captureToDoWrite } from "./todo-writer"
import { updateTokenState } from "./session-token-state"
import type { LeadConfig } from "../config/schema"
import type { ResolvedContinuationConfig } from "../config/continuation"

export interface CreateHooksArgs {
  pluginConfig: LeadConfig
  continuation: ResolvedContinuationConfig
  directory: string
}

export interface CreatedHooks {
  checkContextWindow: typeof checkContextWindow
  createWriteGuard: typeof createWriteGuard
  shouldApplyVariant: typeof shouldApplyVariant
  markApplied: typeof markApplied
  markSessionCreated: typeof markSessionCreated
  clearSession: typeof clearSession
  processMessageForKeywords: typeof processMessageForKeywords
  checkArchitectWrite: typeof checkArchitectWrite
  handleStartImplementation: typeof handleStartImplementation
  checkContinuation: typeof checkContinuation
  checkCompactionRecovery: typeof checkCompactionRecovery
  buildVerificationReminder: typeof buildVerificationReminder
  applyTodoDescriptionOverride: typeof applyTodoDescriptionOverride
  checkStaleTodos: typeof checkStaleTodos
  buildTodoPreservationPrompt: typeof buildTodoPreservationPrompt
  captureToDoWrite: typeof captureToDoWrite
  updateTokenState: typeof updateTokenState
}

/**
 * Check if a hook is enabled based on the plugin config.
 */
function isHookEnabled(hookName: string, disabledHooks: string[]): boolean {
  return !disabledHooks.includes(hookName)
}

/**
 * Create all hook instances, respecting disabled_hooks configuration.
 * Disabled hooks return null in the returned object.
 */
export function createHooks(args: CreateHooksArgs): CreatedHooks {
  const disabled = args.pluginConfig.disabled_hooks ?? []

  // All hooks are pure functions — we return them conditionally
  // (in a real implementation, disabled hooks would return no-op variants)
  // For v0.1, we return all hooks but the plugin adapter checks disabled_hooks
  const _ = isHookEnabled // used by plugin adapter

  return {
    checkContextWindow: isHookEnabled("context-window-monitor", disabled)
      ? checkContextWindow
      : () => ({ severity: "ok" as const, usagePercent: 0 }),

    createWriteGuard: isHookEnabled("write-guard", disabled)
      ? createWriteGuard
      : () => ({
          markRead: () => {},
          markWritten: () => {},
          checkWrite: async () => ({ allowed: true }),
          processToolCall: () => {},
          getState: () => ({ readFiles: new Set(), writtenFiles: new Set() }),
        }),

    shouldApplyVariant: isHookEnabled("first-message-variant", disabled)
      ? shouldApplyVariant
      : () => false,

    markApplied,
    markSessionCreated,
    clearSession,

    processMessageForKeywords: isHookEnabled("keyword-detector", disabled)
      ? processMessageForKeywords
      : () => ({ keywords: [] }),

    checkArchitectWrite: isHookEnabled("architect-md-only", disabled)
      ? checkArchitectWrite
      : () => ({ verdict: "allow" as const }),

    handleStartImplementation: isHookEnabled("implement", disabled)
      ? handleStartImplementation
      : async () => ({ prompt: null }),

    checkContinuation: isHookEnabled("work-continuation", disabled)
      ? checkContinuation
      : () => ({ continuationPrompt: null }),

    checkCompactionRecovery: isHookEnabled("compaction-recovery", disabled)
      ? checkCompactionRecovery
      : () => ({ recoveryPrompt: null }),

    buildVerificationReminder: isHookEnabled("verification-reminder", disabled)
      ? buildVerificationReminder
      : () => ({ reminderText: null }),

    applyTodoDescriptionOverride: isHookEnabled("todo-description-override", disabled)
      ? applyTodoDescriptionOverride
      : (_tool: string, desc: string) => desc,

    checkStaleTodos: isHookEnabled("todo-continuation", disabled)
      ? checkStaleTodos
      : () => ({ hasStale: false, prompt: null, staleTodos: [] }),

    buildTodoPreservationPrompt: isHookEnabled("compaction-todo-preserver", disabled)
      ? buildTodoPreservationPrompt
      : () => null,

    captureToDoWrite: isHookEnabled("todo-writer", disabled)
      ? captureToDoWrite
      : () => ({ captured: false }),

    updateTokenState: isHookEnabled("session-token-state", disabled)
      ? updateTokenState
      : (_sessionId: string, _delta: object) => ({
          sessionId: _sessionId,
          inputTokens: 0,
          outputTokens: 0,
          contextWindow: 0,
          lastUpdatedAt: new Date(),
        }),
  }
}
