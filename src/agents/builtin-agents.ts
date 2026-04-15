import type { AgentConfig } from "@opencode-ai/sdk"
import type { LeadAgentName, AgentFactory } from "./types"
import type { BuildAgentOptions } from "./agent-builder"
import { buildAgent } from "./agent-builder"
import type { AgentOverrideConfig } from "../config/schema"
import { getDefaultModel } from "./model-resolution"
import { createLeadAgent } from "./tech-lead/index"
import { createExecutorAgent } from "./lead-dev/index"
import { createEngineerAgent } from "./engineer/index"
import { createArchitectAgent } from "./architect/index"
import { createCodeAnalystAgent } from "./code-analyst/index"
import { createResearcherAgent } from "./researcher/index"
import { createReviewerAgent } from "./reviewer/index"
import { createGuardianAgent } from "./guardian/index"
import { createTesterAgent } from "./tester/index"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentMetadata {
  category: string
  cost: "CHEAP" | "MODERATE" | "EXPENSIVE"
  triggers: Array<{ domain: string; trigger: string }>
  useWhen?: string
  avoidWhen?: string
}

export interface CreateBuiltinAgentsOptions {
  uiModel?: string
  disabledAgents?: Set<string>
  configOverrides?: Record<string, AgentOverrideConfig>
  buildOptions?: Omit<BuildAgentOptions, "disabledAgents">
}

// ---------------------------------------------------------------------------
// Agent factory registry
// ---------------------------------------------------------------------------

export const AGENT_FACTORIES: Record<LeadAgentName, AgentFactory> = {
  "tech-lead": createLeadAgent,
  "lead-dev": createExecutorAgent,
  engineer: createEngineerAgent,
  architect: createArchitectAgent,
  "code-analyst": createCodeAnalystAgent,
  researcher: createResearcherAgent,
  reviewer: createReviewerAgent,
  tester: createTesterAgent,
  guardian: createGuardianAgent,
}

// ---------------------------------------------------------------------------
// Agent metadata
// ---------------------------------------------------------------------------

export const AGENT_METADATA: Record<LeadAgentName, AgentMetadata> = {
  "tech-lead": {
    category: "orchestrator",
    cost: "EXPENSIVE",
    triggers: [
      { domain: "Orchestration", trigger: "Complex multi-step tasks needing full orchestration" },
      { domain: "Architecture", trigger: "High-level technical direction and decisions" },
    ],
    useWhen: "Complex tasks spanning multiple domains or agents",
    avoidWhen: "Simple single-step implementation tasks",
  },
  "lead-dev": {
    category: "execution",
    cost: "EXPENSIVE",
    triggers: [
      { domain: "Plan execution", trigger: "A plan exists and needs to be implemented step-by-step" },
    ],
    useWhen: "Driving implementation of a pre-existing plan via /implement",
    avoidWhen: "No plan exists yet",
  },
  engineer: {
    category: "implementation",
    cost: "MODERATE",
    triggers: [
      { domain: "Implementation", trigger: "Writing code, fixing bugs, implementing features" },
    ],
    useWhen: "Domain-specific implementation work within a category",
    avoidWhen: "Planning or research phases",
  },
  architect: {
    category: "planning",
    cost: "MODERATE",
    triggers: [
      { domain: "Planning", trigger: "Creating implementation plans or feature breakdowns" },
    ],
    useWhen: "Strategic planning, task breakdown, writing .md plan files",
    avoidWhen: "Direct code implementation",
  },
  "code-analyst": {
    category: "exploration",
    cost: "CHEAP",
    triggers: [
      { domain: "Exploration", trigger: "Understanding existing code, tracing dependencies" },
    ],
    useWhen: "Read-only codebase exploration and pattern discovery",
    avoidWhen: "Writing or modifying any files",
  },
  researcher: {
    category: "research",
    cost: "CHEAP",
    triggers: [
      { domain: "Research", trigger: "Looking up external APIs, libraries, or documentation" },
    ],
    useWhen: "External documentation, library research, best practices lookup",
    avoidWhen: "Internal codebase tasks",
  },
  reviewer: {
    category: "review",
    cost: "MODERATE",
    triggers: [
      { domain: "Review", trigger: "Validating implementation quality and correctness" },
    ],
    useWhen: "Code review, quality validation, acceptance checking",
    avoidWhen: "Initial implementation phase",
  },
  tester: {
    category: "verification",
    cost: "CHEAP",
    triggers: [
      { domain: "Testing", trigger: "Running tests, linters, and type checks to verify implementation" },
    ],
    useWhen: "Verifying code compiles, tests pass, linting is clean after implementation",
    avoidWhen: "Writing code or making changes — tester only observes and reports",
  },
  guardian: {
    category: "security",
    cost: "MODERATE",
    triggers: [
      { domain: "Security", trigger: "Security review, vulnerability assessment, compliance" },
    ],
    useWhen: "Security audits, vulnerability checks, spec compliance review",
    avoidWhen: "Non-security related tasks (fast-exit with APPROVE if irrelevant)",
  },
}

// Allow registering custom agent metadata
const customAgentMetadata: Map<string, AgentMetadata> = new Map()

export function registerCustomAgentMetadata(name: string, metadata: AgentMetadata): void {
  customAgentMetadata.set(name, metadata)
}

export function getAllAgentMetadata(): Record<string, AgentMetadata> {
  const result: Record<string, AgentMetadata> = { ...AGENT_METADATA }
  for (const [name, meta] of customAgentMetadata) {
    result[name] = meta
  }
  return result
}

// ---------------------------------------------------------------------------
// Factory: create all builtin agents
// ---------------------------------------------------------------------------

/**
 * Builds all 8 builtin agents, respecting disabled list, model overrides,
 * config overrides, and skill resolution options.
 *
 * Returns a record mapping agent names to their resolved `AgentConfig`.
 * Disabled agents are excluded from the result.
 */
export function createBuiltinAgents(
  options: CreateBuiltinAgentsOptions = {}
): Partial<Record<LeadAgentName, AgentConfig>> {
  const {
    uiModel,
    disabledAgents = new Set(),
    configOverrides = {},
    buildOptions = {},
  } = options

  const result: Partial<Record<LeadAgentName, AgentConfig>> = {}

  for (const [name, factory] of Object.entries(AGENT_FACTORIES) as [LeadAgentName, AgentFactory][]) {
    if (disabledAgents.has(name)) continue

    // Resolve model: primary agents use UI model, others use tier default
    // (strategic → Opus, engineering → Sonnet)
    const resolvedModel =
      factory.mode === "primary" && uiModel
        ? uiModel
        : getDefaultModel(name)

    // Build base config
    let config = buildAgent(factory, resolvedModel, {
      ...buildOptions,
      disabledAgents,
    })

    // Preserve the agent mode so OpenCode knows which are user-selectable
    config.mode = factory.mode

    // Apply config overrides if present
    const override = configOverrides[name]
    if (override) {
      config = {
        ...config,
        ...(override.model !== undefined && { model: override.model }),
        ...(override.tools !== undefined && {
          tools: { ...(config.tools ?? {}), ...override.tools },
        }),
      }
    }

    result[name] = config
  }

  return result
}
