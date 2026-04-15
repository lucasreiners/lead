import type { AgentConfig } from "@opencode-ai/sdk"
import type { PluginInput } from "@opencode-ai/plugin"
import type { LeadConfig } from "./config/schema"
import type { ResolvedContinuationConfig } from "./config/continuation"
import type { ResolveSkillsFn } from "./agents/agent-builder"
import { createBuiltinAgents, registerCustomAgentMetadata } from "./agents/builtin-agents"
import { buildCustomAgent, buildCustomAgentMetadata } from "./agents/custom-agent-factory"
import { ConfigHandler } from "./managers/config-handler"
import { BackgroundManager } from "./managers/background-manager"
import { SkillMcpManager } from "./managers/skill-mcp-manager"
import { getAgentDisplayName } from "./shared/agent-display-names"

/**
 * L.E.A.D. manager instances created during plugin initialization.
 */
export interface LeadManagers {
  /** Handles registering agents into OpenCode config */
  configHandler: ConfigHandler
  /** Manages background task spawning and lifecycle */
  backgroundManager: BackgroundManager
  /** Manages MCP server connections from skills (v0.1: stub) */
  skillMcpManager: SkillMcpManager
  /** All registered agent configs (builtin + custom) */
  agents: Record<string, AgentConfig>
}

export interface CreateManagersOptions {
  ctx: PluginInput
  pluginConfig: LeadConfig
  continuation: ResolvedContinuationConfig
  resolveSkills?: ResolveSkillsFn
}

/**
 * Create all L.E.A.D. manager instances.
 * Builds builtin agents, applies config overrides, adds custom agents.
 */
export async function createManagers(options: CreateManagersOptions): Promise<LeadManagers> {
  const { ctx, pluginConfig, resolveSkills } = options

  // Determine disabled agents from config
  const disabledAgents = new Set<string>(pluginConfig.disabled_agents ?? [])
  const disabledSkills = new Set<string>(pluginConfig.disabled_skills ?? [])

  // Build builtin agents
  const builtinAgents = createBuiltinAgents({
    // uiModel: not available at this layer — resolved by each factory
    disabledAgents,
    configOverrides: pluginConfig.agents ?? {},
    buildOptions: {
      resolveSkills,
      disabledSkills,
    },
  })

  // Build custom agents
  const customAgents: Record<string, AgentConfig> = {}
  if (pluginConfig.custom_agents) {
    for (const [name, customConfig] of Object.entries(pluginConfig.custom_agents)) {
      if (disabledAgents.has(name)) continue
      const agentConfig = await buildCustomAgent(name, customConfig, {
        directory: ctx.directory,
        resolveSkills,
        disabledSkills,
      })
      customAgents[name] = agentConfig

      // Register metadata for dynamic prompts (used by getAllAgentMetadata)
      const metadata = buildCustomAgentMetadata(name, customConfig)
      registerCustomAgentMetadata(name, metadata)
    }
  }

  const allAgents = { ...builtinAgents, ...customAgents }

  // Apply display name overrides
  for (const [name, config] of Object.entries(allAgents)) {
    const displayName = getAgentDisplayName(name)
    if (displayName !== name && !config.description) {
      config.description = displayName
    }
  }

  const configHandler = new ConfigHandler({
    builtinAgents,
    customAgents,
  })

  const backgroundManager = new BackgroundManager(
    pluginConfig.background?.max_concurrent ?? 3,
  )

  const skillMcpManager = new SkillMcpManager()

  return {
    configHandler,
    backgroundManager,
    skillMcpManager,
    agents: allAgents,
  }
}
