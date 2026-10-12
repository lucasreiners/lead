import type { Plugin } from "@opencode/plugin"
import { handleFinalizeIssue } from "../../hooks/finalize-issue-hook"
import { handleReadExistingIssue } from "../../hooks/read-existing-issue-hook"
import { handleRunWorkflow } from "../../features/workflow/hook"
import type { V2HookOptions } from "./v2-hooks"

export async function registerV2Commands(ctx: Plugin.Context, { hooks, pluginConfig }: V2HookOptions): Promise<void> {
  const definitions = [
    { name: "implement", description: "Execute a L.E.A.D. plan. Usage: /implement [ticket-or-plan-name]", agent: "lead-dev" },
    { name: "run-workflow", description: "Run a L.E.A.D. workflow. Usage: /run-workflow [name] [goal]" },
    { name: "finalize-issue", description: "Push the finalized requirement to your ticket system.", agent: "product-owner" },
    { name: "read-existing-issue", description: "Import a ticket. Usage: /read-existing-issue <ticket-id>", agent: "product-owner" },
  ]
  await ctx.command.transform((editor) => {
    for (const definition of definitions) {
      editor.add({
        name: definition.name,
        description: definition.description,
        async execute({ sessionID, prompt, delivery }) {
          const session = await ctx.session.get({ sessionID })
          const directory = session.location.directory
          let text = prompt.text
          let agent = definition.agent
          if (definition.name === "implement") {
            const result = await hooks.handleStartImplementation({ args: text, sessionId: sessionID, directory })
            text = result.error ? `❌ ${result.error}` : result.prompt ?? text
          } else if (definition.name === "run-workflow") {
            const result = await handleRunWorkflow({ promptText: text, sessionId: sessionID, directory, customDirs: pluginConfig.workflows?.directories })
            text = result.message ?? result.action?.prompt ?? result.action?.reason ?? text
            agent = result.action?.agent
          } else if (definition.name === "finalize-issue") {
            text = handleFinalizeIssue(text).prompt
          } else {
            const result = handleReadExistingIssue(text)
            text = result.error ? `❌ ${result.error}` : result.prompt
          }
          if (agent) await ctx.session.switchAgent({ sessionID, agent })
          // Keep attachments and append generated instructions so mention offsets survive.
          await ctx.session.prompt({ ...prompt, sessionID, text: `${prompt.text}\n\n${text}`, delivery })
        },
      })
    }
  })
}
