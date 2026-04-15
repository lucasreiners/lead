import type { WorkflowInstance, WorkflowStepDefinition, WorkflowDefinition } from "../../features/workflow/types"

/**
 * Interface for workflow prompt composition.
 * Implementation lives in features/workflow/context.
 */
export interface WorkflowContext {
  /** Build the step prompt with variable substitution and context threading */
  buildStepPrompt(
    instance: WorkflowInstance,
    stepDef: WorkflowStepDefinition,
    definition: WorkflowDefinition,
  ): string
}
