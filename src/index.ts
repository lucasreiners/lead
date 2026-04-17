import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { setClient } from "./shared/log"
import { updateBuiltinDisplayName } from "./shared/agent-display-names"
import { loadLeadConfig } from "./config/loader"
import { resolveContinuationConfig } from "./config/continuation"
import { createTools } from "./create-tools"
import { createManagers } from "./create-managers"
import { createHooks } from "./hooks/create-hooks"
import { createPluginInterface } from "./plugin/plugin-interface"

declare const __LEAD_VERSION__: string | undefined

const LEAD_VERSION = typeof __LEAD_VERSION__ !== "undefined" ? __LEAD_VERSION__ : "dev"

/**
 * Lead OpenCode Plugin.
 *
 * An enterprise-grade AI agent fleet for software development.
 * Provides 8 professional agents: lead, executor, engineer, architect,
 * code-analyst, researcher, reviewer, and guardian.
 */
const LeadPlugin: Plugin = async (ctx) => {
  // 1. Wire logging
  setClient(ctx.client)

  // 2. Load configuration
  const pluginConfig = loadLeadConfig(ctx.directory)

  // 3. Inject version into Tech Lead display name
  updateBuiltinDisplayName("tech-lead", `Tech Lead (v${LEAD_VERSION})`)

  // 4. Resolve continuation defaults
  const continuation = resolveContinuationConfig(pluginConfig.continuation)

  // 5. Load skills and create resolver
  const { resolveSkills } = await createTools({ ctx, pluginConfig })

  // 6. Build agent fleet and managers
  const { configHandler } = await createManagers({
    ctx,
    pluginConfig,
    continuation,
    resolveSkills,
  })

  // 7. Create hooks
  const hooks = createHooks({
    pluginConfig,
    continuation,
    directory: ctx.directory,
  })

  // 8. Assemble and return the plugin interface
  return createPluginInterface({
    pluginConfig,
    directory: ctx.directory,
    configHandler,
    hooks,
  })
}

export default {
  id: "lead",
  server: LeadPlugin,
} satisfies PluginModule

export { LeadPlugin }
export type { LeadConfig } from "./config/schema"
export type { LeadAgentName } from "./agents/types"
