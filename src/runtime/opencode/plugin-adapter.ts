import type { Hooks, Config } from "@opencode-ai/plugin"
import type { Part } from "@opencode-ai/sdk"
import type { ConfigHandler } from "../../managers/config-handler"
import type { CreatedHooks } from "../../hooks/create-hooks"
import type { LeadConfig } from "../../config/schema"
import { handleRunWorkflow, checkWorkflowContinuation, handleWorkflowCommand } from "../../features/workflow/hook"
import { handleFinalizeIssue } from "../../hooks/finalize-issue-hook"
import { handleReadExistingIssue } from "../../hooks/read-existing-issue-hook"
import { checkContinuation } from "../../hooks/work-continuation"
import { checkCompactionRecovery } from "../../hooks/compaction-recovery"
import { buildTodoPreservationPrompt } from "../../hooks/compaction-todo-preserver"
import { markSessionCreated } from "../../hooks/first-message-variant"
import { captureToDoWrite } from "../../hooks/todo-writer"
import { capturePlanWrite } from "../../hooks/plan-capture"
import { info, debug } from "../../shared/log"

/**
 * Create a synthetic Part from text content (for command outputs).
 * The Part type from SDK requires full hydrated fields; we cast for hook output.
 */
function textPart(text: string): Part {
  return {
    id: `synthetic-${Date.now()}`,
    sessionID: "",
    messageID: "",
    type: "text",
    text,
  } as unknown as Part
}

// In-memory tracking: which agent is active per session
const sessionAgentMap = new Map<string, string>()

// Pending continuation prompts per session (injected on next chat.message)
const pendingContinuations = new Map<string, string[]>()

/**
 * Plugin adapter arguments.
 */
export interface PluginAdapterArgs {
  pluginConfig: LeadConfig
  directory: string
  configHandler: ConfigHandler
  hooks: CreatedHooks
}

/**
 * Create the plugin adapter that bridges L.E.A.D. internals to OpenCode hooks.
 */
export function createPluginAdapter(args: PluginAdapterArgs): Hooks {
  const { pluginConfig, directory, configHandler, hooks } = args

  return {
    /**
     * Register all L.E.A.D. agents into OpenCode's config.
     */
    config: async (config: Config) => {
      debug("plugin", "config hook called")
      configHandler.handle(config)
    },

    /**
     * Tool registry (empty — OpenCode provides tools).
     */
    tool: {},

    /**
     * Chat message hook — track active agent, inject pending continuations.
     */
    "chat.message": async (input, output) => {
      const { sessionID, agent } = input
      debug("plugin", `chat.message: session=${sessionID} agent=${agent}`)

      // Track which agent is active per session
      if (agent) {
        sessionAgentMap.set(sessionID, agent)
      }

      // Mark session as created for first-message variant
      markSessionCreated(sessionID)

      // Inject any pending continuation prompts from last session.idle
      const pending = pendingContinuations.get(sessionID)
      if (pending && pending.length > 0) {
        for (const prompt of pending) {
          output.parts.push(textPart(prompt))
        }
        pendingContinuations.delete(sessionID)
      }
    },

    /**
     * Chat params hook — modify LLM parameters if needed.
     */
    "chat.params": async (_input, _output) => {
      // No-op in v0.1
    },

    /**
     * Event hook — handle session lifecycle events.
     * Note: event hook has no output parameter — we store continuation prompts
     * in memory and inject them on the next chat.message.
     */
    event: async ({ event }) => {
      debug("plugin", `event: ${event.type}`)

      // Session idle — check for work continuation and workflow advancement
      if (event.type === "session.idle" || (event.type as string) === "session.updated") {
        const sessionID = (event as unknown as { sessionID?: string }).sessionID ?? ""
        const prompts: string[] = []

        // Check work continuation
        const continuationResult = checkContinuation({
          sessionId: sessionID,
          directory,
        })
        if (continuationResult.continuationPrompt) {
          info("plugin", "Work continuation detected")
          prompts.push(continuationResult.continuationPrompt)
        }

        // Check workflow continuation
        const workflowResult = await checkWorkflowContinuation({
          sessionId: sessionID,
          directory,
          customDirs: pluginConfig.workflows?.directories,
        })
        if (workflowResult?.continuationPrompt) {
          info("plugin", "Workflow continuation detected")
          prompts.push(workflowResult.continuationPrompt)
        }

        // Store for injection on next chat.message
        if (prompts.length > 0) {
          pendingContinuations.set(sessionID, prompts)
        }
      }
    },

    /**
     * Tool execute before — write guard, architect-md-only, rules injector.
     */
    "tool.execute.before": async (input, output) => {
      const { tool, sessionID } = input
      const args = output.args as Record<string, unknown>

      debug("plugin", `tool.execute.before: ${tool}`)

      // Check architect md-only constraint (using tracked agent from chat.params/chat.message)
      const activeAgent = sessionAgentMap.get(sessionID)
      const architectResult = hooks.checkArchitectWrite({ toolName: tool, args, agentName: activeAgent })
      if (architectResult.verdict === "deny") {
        info("plugin", `Architect md-only guard blocked: ${architectResult.reason}`)
        // Neutralize the tool call by clearing the file path args
        // This prevents the write/edit from executing on the target file
        if ("filePath" in args) args["filePath"] = ""
        if ("path" in args) args["path"] = ""
        if ("content" in args) args["content"] = `<!-- BLOCKED: ${architectResult.reason} -->`
        return
      }

      // Capture todo writes
      captureToDoWrite({ toolName: tool, args, sessionId: sessionID })
    },

    /**
     * Tool execute after — verification reminder, token tracking, plan capture.
     */
    "tool.execute.after": async (input, _output) => {
      const { tool, sessionID, args } = input
      debug("plugin", `tool.execute.after: ${tool}`)

      // Capture plan writes from architect agent
      const activeAgent = sessionAgentMap.get(sessionID)
      capturePlanWrite({
        toolName: tool,
        args: args as Record<string, unknown>,
        agentName: activeAgent,
        sessionId: sessionID,
        directory,
      })

      // Build verification reminder (fire-and-forget, non-blocking)
      const reminder = hooks.buildVerificationReminder({
        toolName: tool,
        directory,
      })
      if (reminder.reminderText) {
        debug("plugin", "Verification reminder triggered")
      }

      void sessionID // used in token tracking (future)
    },

    /**
     * Command execute before — handle /implement, /run-workflow.
      */
    "command.execute.before": async (input, output) => {
      const { command, sessionID, arguments: cmdArgs } = input

      debug("plugin", `command: /${command} ${cmdArgs}`)

      if (command === "implement") {
        const result = await hooks.handleStartImplementation({
          args: cmdArgs,
          sessionId: sessionID,
          directory,
        })
        if (result.prompt) {
          output.parts = [textPart(result.prompt)]
        } else if (result.error) {
          output.parts = [textPart(`❌ ${result.error}`)]
        }
        return
      }

      if (command === "run-workflow") {
        const result = await handleRunWorkflow({
          promptText: cmdArgs,
          sessionId: sessionID,
          directory,
          customDirs: pluginConfig.workflows?.directories,
        })
        if (result.message) {
          output.parts = [textPart(result.message)]
        }
        return
      }

      if (command === "finalize-issue") {
        const result = handleFinalizeIssue(cmdArgs)
        output.parts = [textPart(result.prompt)]
        return
      }

      if (command === "read-existing-issue") {
        const result = handleReadExistingIssue(cmdArgs)
        if (result.error) {
          output.parts = [textPart(`❌ ${result.error}`)]
        } else {
          output.parts = [textPart(result.prompt)]
        }
        return
      }

      // Check for inline workflow commands in message
      const workflowResult = handleWorkflowCommand(cmdArgs, directory)
      if (workflowResult) {
        output.parts = [textPart(workflowResult)]
      }
    },

    /**
     * Tool definition hook — apply description overrides.
     */
    "tool.definition": async (input, output) => {
      const { toolID } = input
      const overriddenDesc = hooks.applyTodoDescriptionOverride(toolID, output.description)
      if (overriddenDesc !== output.description) {
        output.description = overriddenDesc
      }
    },

    /**
     * Session compacting hook — inject recovery context.
     */
    "experimental.session.compacting": async (input, output) => {
      const { sessionID } = input

      // Inject compaction recovery context
      const recovery = checkCompactionRecovery({ sessionId: sessionID, directory })
      if (recovery.recoveryPrompt) {
        output.context.push(recovery.recoveryPrompt)
      }

      // Preserve todo state
      const todoPreservation = buildTodoPreservationPrompt(sessionID)
      if (todoPreservation) {
        output.context.push(todoPreservation)
      }
    },
  }
}
