import { discoverWorkflows } from "./discovery"
import {
  startWorkflow,
  checkAndAdvance,
  pauseWorkflow,
  resumeWorkflow,
  abortWorkflow,
} from "./engine"
import { loadActiveInstance } from "./storage"
import type { EngineAction } from "./types"
import { WORKFLOW_CONTINUATION_MARKER } from "./constants"

export interface RunWorkflowInput {
  promptText: string
  sessionId: string
  directory: string
  customDirs?: string[]
}

export interface RunWorkflowResult {
  handled: boolean
  action?: EngineAction
  message?: string
}

/**
 * Parse /run-workflow args: `<workflow-name> "goal text"` or `<workflow-name> goal text`
 */
export function parseWorkflowArgs(args: string): { workflowName: string | null; goal: string | null } {
  const trimmed = args.trim()
  if (!trimmed) return { workflowName: null, goal: null }

  // Try to match: name "quoted goal"
  const quotedMatch = /^([^\s"]+)\s+"([^"]+)"/.exec(trimmed)
  if (quotedMatch) {
    return { workflowName: quotedMatch[1], goal: quotedMatch[2] }
  }

  // Try: name goal text (split on first space)
  const spaceIdx = trimmed.indexOf(" ")
  if (spaceIdx !== -1) {
    return {
      workflowName: trimmed.slice(0, spaceIdx),
      goal: trimmed.slice(spaceIdx + 1).trim(),
    }
  }

  // Just a name, no goal
  return { workflowName: trimmed, goal: null }
}

/**
 * Handle /run-workflow command.
 * Supports starting new workflows and resuming active ones.
 */
export async function handleRunWorkflow(input: RunWorkflowInput): Promise<RunWorkflowResult> {
  const { promptText, sessionId, directory, customDirs } = input

  // Strip the command prefix
  const argsText = promptText.replace(/^\/run-workflow\s*/, "").trim()
  const { workflowName, goal } = parseWorkflowArgs(argsText)

  // Discover available workflows
  const discovered = discoverWorkflows({ projectDirectory: directory, customDirs })

  // Check for active workflow
  const active = loadActiveInstance(directory)

  // No name provided
  if (!workflowName) {
    if (active) {
      // Resume active workflow
      const def = discovered.find((d) => d.definition.name === active.definition_id)
      if (!def) {
        return {
          handled: true,
          message: `Active workflow '${active.definition_id}' definition not found.`,
        }
      }
      const action = resumeWorkflow(directory, def.definition)
      return { handled: true, action }
    }

    // List available
    if (discovered.length === 0) {
      return {
        handled: true,
        message:
          "No workflows found. Create workflow definitions in `.opencode/workflows/` or `~/.config/opencode/workflows/`.",
      }
    }
    const list = discovered.map((d) => `- **${d.definition.name}**: ${d.definition.description ?? "no description"}`).join("\n")
    return {
      handled: true,
      message: `Available workflows:\n${list}\n\nUse \`/run-workflow <name> "your goal"\` to start.`,
    }
  }

  const def = discovered.find((d) => d.definition.name === workflowName)

  if (!def) {
    return {
      handled: true,
      message: `Workflow '${workflowName}' not found. Available: ${discovered.map((d) => d.definition.name).join(", ") || "none"}`,
    }
  }

  if (!goal) {
    if (active?.definition_id === workflowName) {
      // Resume matching active
      const action = resumeWorkflow(directory, def.definition)
      return { handled: true, action }
    }
    return {
      handled: true,
      message: `Please provide a goal for workflow '${workflowName}'. Usage: /run-workflow ${workflowName} "your goal"`,
    }
  }

  if (active && active.status === "running") {
    return {
      handled: true,
      message: `A workflow is already active: '${active.definition_id}'. Abort it first with "workflow abort".`,
    }
  }

  const action = startWorkflow({
    definition: def.definition,
    definitionPath: def.path,
    goal,
    sessionId,
    directory,
  })

  return { handled: true, action }
}

export interface WorkflowContinuationInput {
  sessionId: string
  directory: string
  lastAssistantMessage?: string
  lastUserMessage?: string
  customDirs?: string[]
}

export interface WorkflowContinuationResult {
  continuationPrompt: string | null
  switchAgent: string | null
}

/**
 * Check if active workflow step is complete and advance.
 * Called on session.idle hook.
 */
export async function checkWorkflowContinuation(
  input: WorkflowContinuationInput
): Promise<WorkflowContinuationResult> {
  const { directory, lastAssistantMessage, lastUserMessage, customDirs } = input

  const active = loadActiveInstance(directory)
  if (!active || active.status !== "running") {
    return { continuationPrompt: null, switchAgent: null }
  }

  const discovered = discoverWorkflows({ projectDirectory: directory, customDirs })
  const def = discovered.find((d) => d.definition.name === active.definition_id)
  if (!def) {
    return { continuationPrompt: null, switchAgent: null }
  }

  const action = checkAndAdvance({
    directory,
    context: { lastAssistantMessage, lastUserMessage, directory },
    definition: def.definition,
  })

  if (action.type === "inject_prompt" && action.prompt) {
    return {
      continuationPrompt: `${WORKFLOW_CONTINUATION_MARKER}\n\n${action.prompt}`,
      switchAgent: action.agent ?? null,
    }
  }

  if (action.type === "complete") {
    return {
      continuationPrompt: `${WORKFLOW_CONTINUATION_MARKER}\n\nWorkflow "${active.definition_name}" completed! All steps are done.`,
      switchAgent: null,
    }
  }

  return { continuationPrompt: null, switchAgent: null }
}

/**
 * Handle inline workflow commands in user messages.
 * Returns a result message or null if not a workflow command.
 */
export function handleWorkflowCommand(
  message: string,
  directory: string
): string | null {
  const lower = message.toLowerCase().trim()

  if (lower === "workflow pause" || lower === "pause workflow") {
    const ok = pauseWorkflow(directory, "User requested pause")
    return ok ? "Workflow paused." : "No active workflow to pause."
  }

  if (lower === "workflow abort" || lower === "abort workflow") {
    const ok = abortWorkflow(directory)
    return ok ? "Workflow aborted." : "No active workflow to abort."
  }

  if (lower === "workflow status" || lower === "status workflow") {
    const active = loadActiveInstance(directory)
    if (!active) return "No active workflow."
    return `Workflow: **${active.definition_name}** | Status: ${active.status} | Step: ${active.current_step_id}`
  }

  return null
}
