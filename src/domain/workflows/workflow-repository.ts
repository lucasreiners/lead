import type { WorkflowInstance, WorkflowDefinition } from "../../features/workflow/types"

/**
 * Repository interface for workflow instance persistence.
 * Implementation lives in features/workflow/storage.
 */
export interface WorkflowRepository {
  /** Save or update a workflow instance */
  save(directory: string, instance: WorkflowInstance): boolean
  /** Load a workflow instance by ID */
  load(directory: string, instanceId: string): WorkflowInstance | null
  /** Get the currently active workflow instance */
  getActive(directory: string): WorkflowInstance | null
  /** Set the active instance pointer */
  setActive(directory: string, instanceId: string): boolean
  /** Clear the active instance pointer */
  clearActive(directory: string): boolean
  /** List all instance IDs */
  list(directory: string): string[]
}
