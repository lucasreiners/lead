import { readFileSync } from "fs"
import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"
import type { CustomAgentConfig } from "../config/schema"
import type { AgentMetadata } from "./builtin-agents"
import type { BuildAgentOptions } from "./agent-builder"
import { buildAgent } from "./agent-builder"
import { resolveSafePath } from "../shared/resolve-safe-path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildCustomAgentOptions extends BuildAgentOptions {
  directory?: string
}

// ---------------------------------------------------------------------------
// Custom agent builder
// ---------------------------------------------------------------------------

/**
 * Builds an `AgentConfig` from a custom agent definition loaded from config.
 *
 * Supports:
 * - Inline `prompt` string
 * - `prompt_file` path (relative to directory, sandboxed via resolveSafePath)
 * - `model`, `tools`, `skills`, `mode`, `description`
 */
export function buildCustomAgent(
  name: string,
  config: CustomAgentConfig,
  options: BuildCustomAgentOptions = {}
): AgentConfig {
  const { directory } = options

  // Resolve prompt
  let promptText: string | undefined = config.prompt

  if (!promptText && config.prompt_file && directory) {
    const safePath = resolveSafePath(directory, config.prompt_file)
    if (safePath) {
      try {
        promptText = readFileSync(safePath, "utf-8")
      } catch {
        // Fall through with undefined prompt
      }
    }
  }

  const baseConfig: AgentConfig & { skills?: string[] } = {
    description: config.description ?? name,
    model: config.model,
    mode: config.mode as AgentMode | undefined,
    prompt: promptText,
    tools: config.tools as Record<string, boolean> | undefined,
    skills: config.skills,
  }

  // Strip undefined values
  for (const key of Object.keys(baseConfig) as (keyof typeof baseConfig)[]) {
    if (baseConfig[key] === undefined) {
      delete baseConfig[key]
    }
  }

  return buildAgent(baseConfig, options.buildOptions?.model ?? config.model ?? "", {
    ...options,
    disabledAgents: options.disabledAgents,
    resolveSkills: options.resolveSkills,
    disabledSkills: options.disabledSkills,
  })
}

// ---------------------------------------------------------------------------
// Custom agent metadata builder
// ---------------------------------------------------------------------------

/**
 * Derives `AgentMetadata` from a `CustomAgentConfig`.
 */
export function buildCustomAgentMetadata(name: string, config: CustomAgentConfig): AgentMetadata {
  return {
    category: "custom",
    cost: "MODERATE",
    triggers: (config.triggers ?? []).map((t) => ({
      domain: t.domain,
      trigger: t.trigger,
    })),
    useWhen: config.description ?? `Custom agent: ${name}`,
  }
}

// ---------------------------------------------------------------------------
// Build-options extension helper
// ---------------------------------------------------------------------------

// Allow passing model directly through options
declare module "./agent-builder" {
  interface BuildAgentOptions {
    buildOptions?: { model?: string }
  }
}
