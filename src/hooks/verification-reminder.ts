/**
 * Verification reminder.
 * Reminds agents to run verification steps after implementation tasks.
 */

export interface VerificationReminderOptions {
  /** The tool that was just executed */
  toolName: string
  /** The agent that executed it */
  agentName?: string
  /** Working directory */
  directory: string
}

export interface VerificationReminderResult {
  /** Reminder text to inject, or null if not applicable */
  reminderText: string | null
}

/** Tools that trigger verification reminders */
const IMPLEMENTATION_TOOLS = new Set([
  "write",
  "Write",
  "edit",
  "Edit",
  "bash",
  "Bash",
])

/** Agents that should receive verification reminders */
const REMINDER_AGENTS = new Set(["lead-dev", "engineer", "tester"])

/**
 * Build a verification reminder after implementation tool use.
 * Only fires for lead-dev/engineer agents after write/edit/bash tools.
 */
export function buildVerificationReminder(
  options: VerificationReminderOptions,
): VerificationReminderResult {
  const { toolName, agentName } = options

  if (!IMPLEMENTATION_TOOLS.has(toolName)) {
    return { reminderText: null }
  }

  if (agentName && !REMINDER_AGENTS.has(agentName)) {
    return { reminderText: null }
  }

  return {
    reminderText: `After making changes, verify your work:
1. Run \`bun run typecheck\` to check for TypeScript errors
2. Run \`bun test\` to ensure tests pass
3. Review changed files for correctness before proceeding`,
  }
}
