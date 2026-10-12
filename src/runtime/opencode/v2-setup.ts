import type { Plugin } from "@opencode/plugin"
import { loadLeadConfig } from "../../config/loader"
import { mergeConfigs } from "../../config/merge"
import { LeadConfigSchema } from "../../config/schema"
import { resolveContinuationConfig } from "../../config/continuation"
import { createManagers } from "../../create-managers"
import { loadSkills } from "../../features/skill-loader/loader"
import { createSkillResolver } from "../../features/skill-loader/resolver"
import { createHooks } from "../../hooks/create-hooks"
import { updateBuiltinDisplayName } from "../../shared/agent-display-names"
import { setLogLevel, warn } from "../../shared/log"
import { registerV2Agents } from "./v2-agents"
import { registerV2Hooks } from "./v2-hooks"

/** V2 owns registrations; the returned cleanup releases our event stream and state. */
export async function setupV2(ctx: Plugin.Context, version: string): Promise<Plugin.Cleanup> {
  const directory = ctx.location.directory
  const pluginConfig = mergeConfigs(loadLeadConfig(directory), LeadConfigSchema.parse(ctx.options))
  if (pluginConfig.log_level) setLogLevel(pluginConfig.log_level)
  updateBuiltinDisplayName("tech-lead", `Tech Lead · ${version}`)
  updateBuiltinDisplayName("product-owner", `Product Owner · ${version}`)

  const continuation = resolveContinuationConfig(pluginConfig.continuation)
  const skills = await loadSkills({
    projectDirectory: directory,
    customDirs: pluginConfig.skill_directories,
    disabledSkills: pluginConfig.disabled_skills,
    fetchSkills: async () => {
      const result = await ctx.skill.list()
      return result.data.map((skill) => ({
        name: skill.id,
        content: skill.content,
        source: "api" as const,
        metadata: { description: skill.description },
      }))
    },
  })
  for (const error of skills.errors) warn("skills", error)

  const { agents } = await createManagers({
    ctx: { directory },
    pluginConfig,
    continuation,
    resolveSkills: createSkillResolver(skills),
  })
  await registerV2Agents(ctx, agents)
  return registerV2Hooks(ctx, {
    pluginConfig,
    continuation,
    hooks: createHooks({ pluginConfig, continuation, directory }),
  })
}
