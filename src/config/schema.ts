import { z } from "zod"

// ---------------------------------------------------------------------------
// Tool & Agent restriction schemas
// ---------------------------------------------------------------------------

const ToolPermissionMapSchema = z.record(z.string(), z.boolean())

const AgentOverrideConfigSchema = z.object({
  model: z.string().optional(),
  skills: z.array(z.string()).optional(),
  tools: ToolPermissionMapSchema.optional(),
  display_name: z.string().optional(),
})

const CustomAgentConfigSchema = z.object({
  prompt: z.string().optional(),
  prompt_file: z.string().optional(),
  model: z.string().optional(),
  skills: z.array(z.string()).optional(),
  tools: ToolPermissionMapSchema.optional(),
  display_name: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  triggers: z
    .array(
      z.object({
        domain: z.string(),
        trigger: z.string(),
      }),
    )
    .optional(),
  description: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Category schemas
// ---------------------------------------------------------------------------

const CategoryConfigSchema = z.object({
  model: z.string().optional(),
  skills: z.array(z.string()).optional(),
})

const CategoriesConfigSchema = z.record(z.string(), CategoryConfigSchema)

// ---------------------------------------------------------------------------
// Background config
// ---------------------------------------------------------------------------

const BackgroundConfigSchema = z.object({
  max_concurrent: z.number().int().positive().optional(),
})

// ---------------------------------------------------------------------------
// Continuation config
// ---------------------------------------------------------------------------

const ContinuationRecoveryConfigSchema = z.object({
  compaction: z.boolean().optional(),
})

const ContinuationIdleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  work: z.boolean().optional(),
  workflow: z.boolean().optional(),
  todo_prompt: z.boolean().optional(),
})

const ContinuationConfigSchema = z.object({
  recovery: ContinuationRecoveryConfigSchema.optional(),
  idle: ContinuationIdleConfigSchema.optional(),
})

// ---------------------------------------------------------------------------
// Workflow config
// ---------------------------------------------------------------------------

const WorkflowConfigSchema = z.object({
  disabled_workflows: z.array(z.string()).optional(),
  directories: z.array(z.string()).optional(),
})

// ---------------------------------------------------------------------------
// Experimental config
// ---------------------------------------------------------------------------

const ExperimentalConfigSchema = z.object({
  enabled: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Root config schema
// ---------------------------------------------------------------------------

export const LeadConfigSchema = z.object({
  $schema: z.string().optional(),
  agents: z.record(z.string(), AgentOverrideConfigSchema).optional(),
  custom_agents: z.record(z.string(), CustomAgentConfigSchema).optional(),
  categories: CategoriesConfigSchema.optional(),
  disabled_hooks: z.array(z.string()).optional(),
  disabled_tools: z.array(z.string()).optional(),
  disabled_agents: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),
  skill_directories: z.array(z.string()).optional(),
  background: BackgroundConfigSchema.optional(),
  continuation: ContinuationConfigSchema.optional(),
  workflows: WorkflowConfigSchema.optional(),
  experimental: ExperimentalConfigSchema.optional(),
  log_level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional(),
})

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type LeadConfig = z.infer<typeof LeadConfigSchema>
export type AgentOverrideConfig = z.infer<typeof AgentOverrideConfigSchema>
export type CustomAgentConfig = z.infer<typeof CustomAgentConfigSchema>
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>
export type CategoriesConfig = z.infer<typeof CategoriesConfigSchema>
export type BackgroundConfig = z.infer<typeof BackgroundConfigSchema>
export type ContinuationConfig = z.infer<typeof ContinuationConfigSchema>
export type ContinuationRecoveryConfig = z.infer<typeof ContinuationRecoveryConfigSchema>
export type ContinuationIdleConfig = z.infer<typeof ContinuationIdleConfigSchema>
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>
export type ExperimentalConfig = z.infer<typeof ExperimentalConfigSchema>
export type ToolPermissionMap = z.infer<typeof ToolPermissionMapSchema>
