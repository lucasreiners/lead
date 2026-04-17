import type { LeadAgentName } from "./types"

// ---------------------------------------------------------------------------
// Model tiers
// ---------------------------------------------------------------------------

/**
 * Strategic tier — high-reasoning agents (orchestration, planning, execution).
 * Gets the most capable model available.
 */
const STRATEGIC_AGENTS: Set<LeadAgentName> = new Set([
  "tech-lead",
  "architect",
  "lead-dev",
  "product-owner",
])

/**
 * Engineering tier — implementation & analysis agents.
 * Gets a fast, capable model optimized for code tasks.
 */
// All agents not in STRATEGIC_AGENTS fall into engineering tier.

// ---------------------------------------------------------------------------
// Fallback chains (evaluated in order — first available wins)
// ---------------------------------------------------------------------------

/** Strategic tier: prefer Opus 4.6, fall back through capable models */
export const STRATEGIC_MODEL_CHAIN: readonly string[] = [
  "github-copilot/claude-opus-4.6",
  "github-copilot/claude-opus-4.5",
  "github-copilot/claude-sonnet-4.6",
  "github-copilot/claude-sonnet-4.5",
  "anthropic/claude-opus-4",
  "anthropic/claude-sonnet-4",
  "github-copilot/gpt-5.4",
  "github-copilot/gpt-4o",
]

/** Engineering tier: prefer Sonnet 4.6, fall back through fast models */
export const ENGINEERING_MODEL_CHAIN: readonly string[] = [
  "github-copilot/claude-sonnet-4.6",
  "github-copilot/claude-sonnet-4.5",
  "github-copilot/claude-sonnet-4",
  "anthropic/claude-sonnet-4",
  "github-copilot/gpt-5.4-mini",
  "github-copilot/gpt-4o",
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolveAgentModelOptions {
  /** The model selected by the user in the UI (only relevant for primary agents) */
  uiModel?: string
  /** Per-agent model override from config */
  configOverride?: string
  /** Global fallback model from config */
  globalFallback?: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the default model chain for an agent based on its tier.
 */
export function getModelChain(agentName: LeadAgentName | string): readonly string[] {
  return STRATEGIC_AGENTS.has(agentName as LeadAgentName)
    ? STRATEGIC_MODEL_CHAIN
    : ENGINEERING_MODEL_CHAIN
}

/**
 * Returns the default (first) model for an agent based on its tier.
 */
export function getDefaultModel(agentName: LeadAgentName | string): string {
  return getModelChain(agentName)[0]!
}

/**
 * Determines which model to use for a given agent.
 *
 * Resolution order:
 * 1. Per-agent config override (highest priority)
 * 2. For primary agents: UI-selected model
 * 3. Global fallback from config
 * 4. Tier default (strategic → Opus, engineering → Sonnet)
 */
export function resolveAgentModel(
  agentName: LeadAgentName | string,
  options: ResolveAgentModelOptions = {}
): string {
  const { uiModel, configOverride, globalFallback } = options

  // 1. Explicit per-agent config override
  if (configOverride) return configOverride

  // 2. Primary agents use the UI model if provided
  if (isPrimaryAgent(agentName) && uiModel) {
    return uiModel
  }

  // 3. Global fallback from config
  if (globalFallback) return globalFallback

  // 4. Tier-based default
  return getDefaultModel(agentName)
}

/**
 * Returns true if the agent is a primary agent (tech-lead, lead-dev).
 * Primary agents appear in the UI model selector.
 */
export function isPrimaryAgent(agentName: LeadAgentName | string): boolean {
  // Primary status is about UI visibility, not model tier
  const PRIMARY_AGENT_NAMES: Set<LeadAgentName> = new Set(["tech-lead", "lead-dev", "product-owner"])
  return PRIMARY_AGENT_NAMES.has(agentName as LeadAgentName)
}

/**
 * Returns true if the agent is in the strategic tier (uses Opus-class models).
 */
export function isStrategicAgent(agentName: LeadAgentName | string): boolean {
  return STRATEGIC_AGENTS.has(agentName as LeadAgentName)
}
