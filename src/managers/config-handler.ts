import type { AgentConfig } from "@opencode-ai/sdk"
import { getAgentDisplayName } from "../shared/agent-display-names"

/**
 * ConfigHandler.
 * Registers all L.E.A.D. agents into OpenCode's agent configuration.
 * Called by the plugin's `config` hook.
 */

export interface ConfigHandlerOptions {
  /** Built-in agent configurations (name → AgentConfig) */
  builtinAgents: Record<string, AgentConfig>
  /** Custom agent configurations (name → AgentConfig) */
  customAgents?: Record<string, AgentConfig>
}

export class ConfigHandler {
  private readonly builtinAgents: Record<string, AgentConfig>
  private readonly customAgents: Record<string, AgentConfig>

  constructor(options: ConfigHandlerOptions) {
    this.builtinAgents = options.builtinAgents
    this.customAgents = options.customAgents ?? {}
  }

  /**
   * Apply all agent configurations to the OpenCode config object.
   * This method mutates the passed config to register all agents.
   */
  handle(config: {
    agent?: Record<string, AgentConfig | undefined>
    default_agent?: string
    permission?: Record<string, unknown> | string
    plugin?: Array<string | [string, { [key: string]: unknown }]>
  }): void {
    const existing = config.agent ?? {}

    // Build a new record with L.E.A.D. agents first (controls UI ordering),
    // then append any pre-existing OpenCode agents that we didn't override.
    const merged: Record<string, AgentConfig | undefined> = {}

    // 1. L.E.A.D. builtin agents — register under display names (controls UI sort order)
    for (const [name, agentConfig] of Object.entries(this.builtinAgents)) {
      const displayName = getAgentDisplayName(name)
      merged[displayName] = {
        ...agentConfig,
        description: agentConfig.description ?? displayName,
      }
    }

    // 2. L.E.A.D. custom agents (may override builtins)
    for (const [name, agentConfig] of Object.entries(this.customAgents)) {
      const displayName = getAgentDisplayName(name)
      merged[displayName] = agentConfig
    }

    // 3. Preserve any existing agents not overridden by L.E.A.D.
    for (const [name, agentConfig] of Object.entries(existing)) {
      if (!(name in merged)) {
        merged[name] = agentConfig
      }
    }

    config.agent = merged

    // Set the default agent so OpenCode shows it first in the UI
    config.default_agent = getAgentDisplayName("tech-lead")

    // Allow the question tool by default (no confirmation prompt)
    if (!config.permission || typeof config.permission === "string") {
      config.permission = { question: "allow" }
    } else if (!config.permission.question) {
      config.permission.question = "allow"
    }

    // Ensure @tarquinen/opencode-dcp is registered as a plugin
    const dcpPlugin = "@tarquinen/opencode-dcp@latest"
    if (!config.plugin) {
      config.plugin = [dcpPlugin]
    } else {
      const alreadyPresent = config.plugin.some((entry) =>
        typeof entry === "string"
          ? entry.startsWith("@tarquinen/opencode-dcp")
          : Array.isArray(entry) && entry[0]?.startsWith("@tarquinen/opencode-dcp"),
      )
      if (!alreadyPresent) {
        config.plugin.push(dcpPlugin)
      }
    }
  }

  /** Get all registered agent names */
  getAgentNames(): string[] {
    return [...Object.keys(this.builtinAgents), ...Object.keys(this.customAgents)]
  }
}
