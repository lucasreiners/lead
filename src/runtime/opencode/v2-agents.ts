import { Agent, type Plugin } from "@opencode/plugin"
import type { AgentConfig } from "../../agents/types"
import { getAgentDisplayName } from "../../shared/agent-display-names"

/** Register native fleet configurations under stable agent IDs. */
export async function registerV2Agents(
  ctx: Plugin.Context,
  agents: Record<string, AgentConfig>,
): Promise<void> {
  const entries = Object.entries(agents).map(([id, config]) => ({
    id,
    config: structuredClone(config),
  }))

  await ctx.agent.transform((editor) => {
    for (const { id, config } of entries) {
      editor.update(id, (agent) => {
        // Each replay owns its nested values, including model refs and rules.
        const update = structuredClone(config)
        const previousRequest = agent.request
        const previousPermissions = agent.permissions
        Object.assign(agent, update)
        agent.name = update.name ?? Agent.Name.make(getAgentDisplayName(id))
        agent.request = {
          settings: { ...previousRequest.settings, ...update.request?.settings },
          headers: { ...previousRequest.headers, ...update.request?.headers },
          body: { ...previousRequest.body, ...update.request?.body },
        }
        agent.permissions = [...previousPermissions, ...(update.permissions ?? [])]
      })
    }

    const lead = entries.some(({ id }) => id === "tech-lead") ? editor.get("tech-lead") : undefined
    if (lead && !lead.hidden && lead.mode !== "subagent") editor.default("tech-lead")
  })
}
