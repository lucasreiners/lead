import type { WorkflowInstance, WorkflowStepDefinition, WorkflowDefinition } from "./types"

/**
 * Substitute template variables in a prompt string.
 * Supported variables:
 *   {{instance.goal}}          — user's stated goal
 *   {{instance.slug}}          — URL-safe slug of goal
 *   {{instance.instance_id}}   — workflow instance ID
 *   {{artifacts.X}}            — artifact value by name
 *   {{step.id}}                — current step ID
 *   {{step.name}}              — current step name
 */
export function substituteTemplateVars(
  template: string,
  instance: WorkflowInstance,
  stepDef: WorkflowStepDefinition
): string {
  return template
    .replace(/\{\{instance\.goal\}\}/g, instance.goal)
    .replace(/\{\{instance\.slug\}\}/g, instance.slug)
    .replace(/\{\{instance\.instance_id\}\}/g, instance.instance_id)
    .replace(/\{\{step\.id\}\}/g, stepDef.id)
    .replace(/\{\{step\.name\}\}/g, stepDef.name)
    .replace(/\{\{artifacts\.([^}]+)\}\}/g, (_match, name: string) => {
      return instance.artifacts[name] ?? `[artifact '${name}' not available]`
    })
}

/**
 * Build the full step context prompt including goal, step info, and previous artifacts.
 */
export function buildStepContext(
  instance: WorkflowInstance,
  stepDef: WorkflowStepDefinition,
  definition: WorkflowDefinition
): string {
  const renderedPrompt = substituteTemplateVars(stepDef.prompt, instance, stepDef)

  const artifactSummary = Object.keys(instance.artifacts).length > 0
    ? Object.entries(instance.artifacts)
        .map(([k, v]) => `**${k}**: ${v}`)
        .join("\n")
    : "(none)"

  const stepIndex = definition.steps.findIndex((s) => s.id === stepDef.id)
  const totalSteps = definition.steps.length

  return [
    renderedPrompt,
    "",
    `**Workflow**: "${definition.name}"`,
    `**Goal**: "${instance.goal}"`,
    `**Step**: ${stepDef.name} (${stepIndex + 1}/${totalSteps})`,
    `**Previous Artifacts**:`,
    artifactSummary,
  ].join("\n")
}
