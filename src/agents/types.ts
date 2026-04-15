import type { AgentConfig } from "@opencode-ai/sdk"

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

// ---------------------------------------------------------------------------
// Re-export AgentConfig for convenience
// ---------------------------------------------------------------------------

export type { AgentConfig }
