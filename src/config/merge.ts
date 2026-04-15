import type { LeadConfig } from "./schema"

/**
 * Deep-merges two LeadConfig objects.
 * - Objects (agents, custom_agents, categories): deep-merged, project overrides
 * - Arrays (disabled_*): unioned and deduplicated
 * - Scalars: project overrides user
 */
export function mergeConfigs(
  user: LeadConfig,
  project: LeadConfig,
): LeadConfig {
  const merged: LeadConfig = { ...user }

  // Merge scalar fields — project wins
  if (project.log_level !== undefined) merged.log_level = project.log_level

  // Merge array fields — union + dedup
  merged.disabled_agents = mergeArrays(user.disabled_agents, project.disabled_agents)
  merged.disabled_tools = mergeArrays(user.disabled_tools, project.disabled_tools)
  merged.disabled_hooks = mergeArrays(user.disabled_hooks, project.disabled_hooks)
  merged.disabled_skills = mergeArrays(user.disabled_skills, project.disabled_skills)
  merged.skill_directories = mergeArrays(user.skill_directories, project.skill_directories)

  // Merge object fields — deep merge
  merged.agents = mergeRecords(user.agents, project.agents)
  merged.custom_agents = mergeRecords(user.custom_agents, project.custom_agents)
  merged.categories = mergeRecords(user.categories, project.categories)

  // Merge nested objects — project overrides scalars, deep merge sub-objects
  if (project.background !== undefined) {
    merged.background = { ...user.background, ...project.background }
  }

  if (project.continuation !== undefined) {
    merged.continuation = {
      recovery: { ...user.continuation?.recovery, ...project.continuation.recovery },
      idle: { ...user.continuation?.idle, ...project.continuation.idle },
    }
  }

  if (project.workflows !== undefined) {
    merged.workflows = {
      disabled_workflows: mergeArrays(
        user.workflows?.disabled_workflows,
        project.workflows.disabled_workflows,
      ),
      directories: mergeArrays(user.workflows?.directories, project.workflows.directories),
    }
  }

  if (project.experimental !== undefined) {
    merged.experimental = { ...user.experimental, ...project.experimental }
  }

  return merged
}

function mergeArrays<T>(a?: T[], b?: T[]): T[] | undefined {
  if (!a && !b) return undefined
  const combined = [...(a ?? []), ...(b ?? [])]
  return [...new Set(combined)]
}

function mergeRecords<T extends object>(
  a?: Record<string, T>,
  b?: Record<string, T>,
): Record<string, T> | undefined {
  if (!a && !b) return undefined
  const result: Record<string, T> = { ...(a ?? {}) }
  for (const [key, val] of Object.entries(b ?? {})) {
    result[key] = { ...(result[key] ?? {}), ...val } as T
  }
  return result
}
