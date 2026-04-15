import { pauseWorkflow, resumeWorkflow, skipStep, abortWorkflow } from "./engine"
import { loadActiveInstance } from "./storage"
import { discoverWorkflows } from "./discovery"
import type { EngineAction } from "./types"

export interface WorkflowCommandResult {
  message: string
  action?: EngineAction
}

/**
 * Parse and execute workflow subcommands.
 * Supported: status, pause, resume, skip [stepId], abort
 */
export function executeWorkflowCommand(
  command: string,
  directory: string,
  customDirs?: string[]
): WorkflowCommandResult {
  const parts = command.trim().split(/\s+/)
  const sub = parts[1]?.toLowerCase()

  switch (sub) {
    case "status": {
      const active = loadActiveInstance(directory)
      if (!active) return { message: "No active workflow." }
      const completed = Object.values(active.steps).filter((s) => s.status === "completed").length
      const total = Object.keys(active.steps).length
      return {
        message: [
          `**Workflow**: ${active.definition_name}`,
          `**Status**: ${active.status}`,
          `**Goal**: ${active.goal}`,
          `**Current Step**: ${active.current_step_id}`,
          `**Progress**: ${completed}/${total} steps completed`,
        ].join("\n"),
      }
    }

    case "pause": {
      const ok = pauseWorkflow(directory, "User requested pause")
      return { message: ok ? "Workflow paused." : "No active workflow to pause." }
    }

    case "resume": {
      const active = loadActiveInstance(directory)
      if (!active) return { message: "No active workflow to resume." }
      const discovered = discoverWorkflows({ projectDirectory: directory, customDirs })
      const def = discovered.find((d) => d.definition.name === active.definition_id)
      if (!def) return { message: `Workflow definition '${active.definition_id}' not found.` }
      const action = resumeWorkflow(directory, def.definition)
      return { message: "Workflow resumed.", action }
    }

    case "skip": {
      const active = loadActiveInstance(directory)
      if (!active) return { message: "No active workflow to skip." }
      const discovered = discoverWorkflows({ projectDirectory: directory, customDirs })
      const def = discovered.find((d) => d.definition.name === active.definition_id)
      if (!def) return { message: `Workflow definition '${active.definition_id}' not found.` }
      const action = skipStep(directory, def.definition)
      return { message: "Step skipped.", action }
    }

    case "abort": {
      const ok = abortWorkflow(directory)
      return { message: ok ? "Workflow aborted." : "No active workflow to abort." }
    }

    default:
      return {
        message: "Unknown workflow command. Available: status, pause, resume, skip, abort",
      }
  }
}
