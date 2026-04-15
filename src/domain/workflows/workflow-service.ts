import type { EngineAction, WorkflowDefinition } from "../../features/workflow/types"

/**
 * Service interface for workflow lifecycle operations.
 * Implementation lives in features/workflow/engine.
 */
export interface WorkflowService {
  /** Start a new workflow instance */
  start(input: {
    definition: WorkflowDefinition
    definitionPath: string
    goal: string
    sessionId: string
    directory: string
  }): EngineAction

  /** Check if current step is complete and advance if so */
  checkAndAdvance(input: {
    directory: string
    context: {
      lastAssistantMessage?: string
      lastUserMessage?: string
      directory: string
    }
  }): EngineAction

  /** Pause the active workflow */
  pause(directory: string, reason?: string): boolean

  /** Resume the active workflow */
  resume(directory: string): EngineAction

  /** Skip the current step */
  skipStep(directory: string): EngineAction

  /** Abort the active workflow */
  abort(directory: string): boolean
}
