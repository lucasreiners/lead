import { z } from "zod"

const StepTypeSchema = z.enum(["interactive", "autonomous", "gate"])
const CompletionMethodSchema = z.enum([
  "user_confirm",
  "plan_created",
  "plan_complete",
  "review_verdict",
  "agent_signal",
])

const CompletionConfigSchema = z.object({
  method: CompletionMethodSchema,
  plan_name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const StepArtifactRefSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const StepArtifactsSchema = z.object({
  inputs: z.array(StepArtifactRefSchema).optional(),
  outputs: z.array(StepArtifactRefSchema).optional(),
})

const WorkflowStepDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Step ID must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  type: StepTypeSchema,
  agent: z.string().min(1),
  prompt: z.string().min(1),
  completion: CompletionConfigSchema,
  artifacts: StepArtifactsSchema.optional(),
  on_reject: z.enum(["pause", "fail"]).optional(),
})

export const WorkflowDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "Workflow name must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
  version: z.literal(1),
  steps: z.array(WorkflowStepDefinitionSchema).min(1, "Workflow must have at least one step"),
}).superRefine((data, ctx) => {
  // Validate step IDs are unique
  const ids = data.steps.map((s) => s.id)
  const unique = new Set(ids)
  if (ids.length !== unique.size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Workflow step IDs must be unique",
    })
  }
})

export type WorkflowDefinitionInput = z.input<typeof WorkflowDefinitionSchema>
