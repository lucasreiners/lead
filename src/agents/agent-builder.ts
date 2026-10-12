import type { AgentConfig, AgentSource } from "./types"
import { isFactory, resolveModel, toolPermissions } from "./types"
import { Model } from "@opencode/plugin"
import type { CategoriesConfig } from "../config/schema"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolveSkillsFn = (skillNames: string[], disabledSkills?: Set<string>) => string

export interface BuildAgentOptions {
  categories?: CategoriesConfig
  /**
   * Category this agent belongs to. Builtin agents carry their category in
   * `AGENT_METADATA` rather than on the emitted config, so it is passed in
   * explicitly.
   */
  category?: string
  skills?: string[]
  disabledSkills?: Set<string>
  resolveSkills?: ResolveSkillsFn
  disabledAgents?: Set<string>
}

// ---------------------------------------------------------------------------
// Agent name variants — for stripping disabled-agent references from prompts
// ---------------------------------------------------------------------------

const AGENT_NAME_VARIANTS: Record<string, string[]> = {
  "tech-lead": ["tech-lead", "Tech Lead"],
  "lead-dev": ["lead-dev", "Lead Developer"],
  engineer: ["engineer", "Engineer", "Software Engineer"],
  architect: ["architect", "Architect", "Software Architect"],
    "code-analyst": ["code-analyst", "Code Analyst"],
  researcher: ["researcher", "Researcher", "Technical Researcher"],
  reviewer: ["reviewer", "Reviewer", "Code Reviewer"],
  tester: ["tester", "Tester"],
  guardian: ["guardian", "Guardian", "Security Guardian"],
}

// Allow external registration of additional variants (e.g. custom agents)
export function registerAgentNameVariants(name: string, variants: string[]): void {
  AGENT_NAME_VARIANTS[name] = [...(AGENT_NAME_VARIANTS[name] ?? []), ...variants]
}

export function addBuiltinNameVariant(name: string, variant: string): void {
  if (!AGENT_NAME_VARIANTS[name]) {
    AGENT_NAME_VARIANTS[name] = []
  }
  if (!AGENT_NAME_VARIANTS[name].includes(variant)) {
    AGENT_NAME_VARIANTS[name].push(variant)
  }
}

export function resetNameVariants(): void {
  for (const key of Object.keys(AGENT_NAME_VARIANTS)) {
    delete AGENT_NAME_VARIANTS[key]
  }
  // Restore defaults
  Object.assign(AGENT_NAME_VARIANTS, {
    "tech-lead": ["tech-lead", "Tech Lead"],
    "lead-dev": ["lead-dev", "Lead Developer"],
    engineer: ["engineer", "Engineer", "Software Engineer"],
    architect: ["architect", "Architect", "Software Architect"],
  "code-analyst": ["code-analyst", "Code Analyst"],
    researcher: ["researcher", "Researcher", "Technical Researcher"],
    reviewer: ["reviewer", "Reviewer", "Code Reviewer"],
    guardian: ["guardian", "Guardian", "Security Guardian"],
  })
}

// ---------------------------------------------------------------------------
// Strip disabled agent references
// ---------------------------------------------------------------------------

/**
 * Removes lines from a prompt that mention disabled agent names.
 * A "line" is considered to mention an agent if it contains any of that
 * agent's known variant strings.
 */
export function stripDisabledAgentReferences(
  prompt: string,
  disabledAgents: Set<string>
): string {
  if (disabledAgents.size === 0) return prompt

  // Build a flat set of all variant strings for disabled agents
  const disabledVariants = new Set<string>()
  for (const name of disabledAgents) {
    const variants = AGENT_NAME_VARIANTS[name] ?? [name]
    for (const v of variants) {
      disabledVariants.add(v)
    }
  }

  const lines = prompt.split("\n")
  const filtered = lines.filter((line) => {
    for (const variant of disabledVariants) {
      if (line.includes(variant)) return false
    }
    return true
  })

  return filtered.join("\n")
}

// ---------------------------------------------------------------------------
// Category config application
// ---------------------------------------------------------------------------

export interface AgentPreferences {
  model?: string
  variant?: string
  temperature?: number
  tools?: Record<string, boolean>
  prompt?: string
}

export function applyAgentPreferences(
  base: AgentConfig,
  preferences: AgentPreferences
): AgentConfig {
  const model = preferences.model
    ? resolveModel(preferences.model)
    : base.model
  const variant = preferences.variant ?? model?.variant ?? base.model?.variant
  return {
    ...base,
    ...(model && { model: variant ? { ...model, variant: Model.VariantID.make(variant) } : model }),
    ...(preferences.prompt !== undefined && { system: preferences.prompt }),
    ...(preferences.temperature !== undefined && {
      request: {
        settings: base.request?.settings ?? {},
        headers: base.request?.headers ?? {},
        body: { ...base.request?.body, temperature: preferences.temperature },
      },
    }),
    ...(preferences.tools !== undefined && {
      permissions: [...(base.permissions ?? []), ...toolPermissions(preferences.tools)],
    }),
  }
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Resolves an `AgentSource` (factory or static config) into a fully
 * populated `AgentConfig`.
 *
 * Steps:
 * 1. Resolve factory → config
 * 2. Apply category overrides
 * 3. Prepend skill content to prompt
 * 4. Strip references to disabled agents
 */
export function buildAgent(
  source: AgentSource,
  model: string,
  options?: BuildAgentOptions
): AgentConfig {
  // 1. Resolve source → mutable config copy
  let config: AgentConfig = isFactory(source)
    ? { ...source(model) }
    : { ...source }

  // 2. Apply category overrides
  const category = options?.category ? options.categories?.[options.category] : undefined
  if (category) {
    config = applyAgentPreferences(config, category)
  }

  // 3. Prepend skill content
  const skills = options?.skills ?? category?.skills
  if (skills?.length && options?.resolveSkills) {
    const skillContent = options.resolveSkills(skills, options.disabledSkills)
    if (skillContent) {
      config.system = skillContent + (config.system ? "\n\n" + config.system : "")
    }
  }

  // 4. Strip disabled agent references
  if (options?.disabledAgents && options.disabledAgents.size > 0 && config.system) {
    config.system = stripDisabledAgentReferences(config.system, options.disabledAgents)
  }

  return config
}
