import type { LeadAgentName } from "./types"
import { trimPrompt } from "./prompt-utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailableAgent {
  name: string
  displayName: string
  description: string
  useWhen?: string
  avoidWhen?: string
  isCustom?: boolean
}

export interface BuildDynamicLeadPromptOptions {
  enabledAgents: AvailableAgent[]
  fingerprint?: string
  customAgentCount?: number
}

// ---------------------------------------------------------------------------
// Delegation table generation
// ---------------------------------------------------------------------------

function buildDelegationTable(agents: AvailableAgent[]): string {
  const rows = agents
    .map((a) => `| **${a.displayName}** | ${a.description} | ${a.useWhen ?? "Complex tasks in domain"} |`)
    .join("\n")

  return `## Team Members

| Agent | Role | Delegate When |
|-------|------|---------------|
${rows}`
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Builds the dynamic section of the CTO agent's system prompt.
 *
 * This is appended to the static prompt.md at runtime so it always reflects
 * the current set of enabled agents and any custom agents loaded from config.
 */
export function buildDynamicLeadPrompt(options: BuildDynamicLeadPromptOptions): string {
  const { enabledAgents, fingerprint, customAgentCount = 0 } = options

  const sections: string[] = []

  // Delegation table
  sections.push(buildDelegationTable(enabledAgents))

  // Custom agents note
  if (customAgentCount > 0) {
    sections.push(
      `> **Note**: ${customAgentCount} custom agent(s) are also available. Check the full agent list when routing.`
    )
  }

  // Fingerprint for change detection
  if (fingerprint) {
    sections.push(`<!-- fingerprint: ${fingerprint} -->`)
  }

  return trimPrompt(sections.join("\n\n"))
}

// ---------------------------------------------------------------------------
// Built-in agent metadata for the delegation table
// ---------------------------------------------------------------------------

export const BUILTIN_AGENT_DISPLAY: Record<LeadAgentName, AvailableAgent> = {
  "tech-lead": {
    name: "tech-lead",
    displayName: "Tech Lead",
    description: "Sets technical direction, orchestrates complex multi-step tasks, routes to specialists",
    useWhen: "Complex tasks needing full orchestration across multiple domains",
    avoidWhen: "Simple single-domain tasks",
  },
  "lead-dev": {
    name: "lead-dev",
    displayName: "Lead Developer",
    description: "Owns implementation — drives plan execution step-by-step, tracks progress",
    useWhen: "Executing an existing implementation plan",
    avoidWhen: "No plan exists yet",
  },
  engineer: {
    name: "engineer",
    displayName: "Software Engineer",
    description: "Domain-specific implementation work",
    useWhen: "Writing code, fixing bugs, implementing features",
    avoidWhen: "Planning or research phases",
  },
  architect: {
    name: "architect",
    displayName: "Software Architect",
    description: "Strategic planning and task breakdown",
    useWhen: "Creating implementation plans, breaking down complex features",
    avoidWhen: "Direct code writing",
  },
  "code-analyst": {
    name: "code-analyst",
    displayName: "Code Analyst",
    description: "Read-only codebase exploration and pattern discovery",
    useWhen: "Understanding existing code, finding patterns, mapping structure",
    avoidWhen: "Writing or modifying files",
  },
  researcher: {
    name: "researcher",
    displayName: "Technical Researcher",
    description: "External documentation, libraries, and best practices",
    useWhen: "Looking up APIs, frameworks, or external resources",
    avoidWhen: "Internal codebase tasks",
  },
  reviewer: {
    name: "reviewer",
    displayName: "Code Reviewer",
    description: "Quality review and acceptance validation",
    useWhen: "Reviewing PRs, validating implementations, quality checks",
    avoidWhen: "Initial implementation",
  },
  tester: {
    name: "tester",
    displayName: "Tester",
    description: "Runs tests, linters, and type checks to verify implementation quality",
    useWhen: "Verifying code compiles, tests pass, linting is clean",
    avoidWhen: "Writing code — tester only observes and reports",
  },
  guardian: {
    name: "guardian",
    displayName: "Security Guardian",
    description: "Security review and spec compliance",
    useWhen: "Security audits, vulnerability checks, compliance review",
    avoidWhen: "Non-security tasks",
  },
}
