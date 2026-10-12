import { Model, type Agent } from "@opencode/plugin"

/** Native registry fields; plugin preferences are resolved before registration. */
export type AgentConfig = { -readonly [K in keyof Omit<Agent.Info, "id">]?: Agent.Info[K] }

export function resolveModel(model: string, variant?: string): NonNullable<AgentConfig["model"]> {
  const ref = Model.Ref.parse(model)
  return variant ? { ...ref, variant: Model.VariantID.make(variant) } : ref
}

/** Resolve lead.jsonc tool preferences into ordered native permission rules. */
export function toolPermissions(tools: Record<string, boolean>): NonNullable<AgentConfig["permissions"]> {
  const aliases: Record<string, string> = { write: "edit", patch: "edit" }
  const actions = new Map<string, boolean>()
  for (const [name, enabled] of Object.entries(tools)) {
    const action = Object.hasOwn(aliases, name) ? aliases[name]! : name
    // A denied edit alias must not be re-enabled by another alias in the same preference map.
    actions.set(action, (actions.get(action) ?? true) && enabled)
  }
  return [...actions].map(([action, enabled]) => ({ action, resource: "*", effect: enabled ? "allow" : "deny" }))
}

// ---------------------------------------------------------------------------
// L.E.A.D. agent names
// ---------------------------------------------------------------------------

export type LeadAgentName =
  | "tech-lead"
  | "lead-dev"
  | "engineer"
  | "architect"
  | "code-analyst"
  | "researcher"
  | "reviewer"
  | "tester"
  | "guardian"
  | "product-owner"

// ---------------------------------------------------------------------------
// Agent modes
// ---------------------------------------------------------------------------

/**
 * primary — user-facing agent, uses UI-selected model
 * subagent — spawned by other agents, uses its own fallback model
 * all — available in both contexts
 */
export type AgentMode = "primary" | "subagent" | "all"

// ---------------------------------------------------------------------------
// Agent factory
// ---------------------------------------------------------------------------

export type AgentFactory = ((model: string) => AgentConfig) & {
  mode: AgentMode
}

export type AgentSource = AgentFactory | AgentConfig

// ---------------------------------------------------------------------------
// Delegation metadata
// ---------------------------------------------------------------------------

export interface DelegationTrigger {
  domain: string
  trigger: string
}

export interface AgentCost {
  tier: "cheap" | "moderate" | "expensive"
  label: string
}

export interface AgentPromptMetadata {
  name: LeadAgentName | string
  displayName: string
  description: string
  mode: AgentMode
  triggers?: DelegationTrigger[]
  cost?: AgentCost
  skills?: string[]
  category?: string
}

// ---------------------------------------------------------------------------
// Type guards & helpers
// ---------------------------------------------------------------------------

export function isFactory(source: AgentSource): source is AgentFactory {
  return typeof source === "function"
}

/**
 * Returns true if the model string looks like a GPT-series model.
 * Used for temperature adjustment (GPT models have different defaults).
 */
export function isGptModel(model: string): boolean {
  const lower = model.toLowerCase()
  return lower.includes("gpt-") || lower.includes("o1") || lower.includes("o3") || lower.includes("o4")
}
