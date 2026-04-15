import type { PluginInput } from "@opencode-ai/plugin"
import type { LeadConfig } from "./config/schema"
import { loadSkills } from "./features/skill-loader/loader"
import { createSkillResolver } from "./features/skill-loader/resolver"
import type { ResolveSkillsFn } from "./agents/agent-builder"
import type { LoadedSkill } from "./features/skill-loader/types"

/**
 * Result of the tools creation step.
 */
export interface ToolsResult {
  /** Loaded skill instances */
  availableSkills: LoadedSkill[]
  /** Resolver function for skill prompt injection */
  resolveSkills: ResolveSkillsFn
  /** (Empty in v0.1 — tools come from OpenCode, not the plugin) */
  tools: Record<string, never>
}

export interface CreateToolsOptions {
  ctx: PluginInput
  pluginConfig: LeadConfig
}

/**
 * Load skills, create the resolver, and return the tools result.
 * In v0.1, the plugin does not register custom tools — OpenCode provides them.
 */
export async function createTools(options: CreateToolsOptions): Promise<ToolsResult> {
  const { ctx, pluginConfig } = options

  // Load skills from API and filesystem
  const skillResult = await loadSkills({
    serverUrl: ctx.serverUrl,
    projectDirectory: ctx.directory,
    disabledSkills: pluginConfig.disabled_skills,
    customDirs: pluginConfig.skill_directories,
  })

  // Create the resolver closure
  const resolveSkills = createSkillResolver(skillResult)

  return {
    availableSkills: skillResult.skills,
    resolveSkills,
    tools: {},
  }
}
