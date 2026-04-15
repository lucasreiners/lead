import { existsSync, readdirSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { parse as parseJsonc } from "jsonc-parser"
import { WorkflowDefinitionSchema } from "./schema"
import { resolveSafePath } from "../../shared/resolve-safe-path"
import type { DiscoveredWorkflow, WorkflowDefinition } from "./types"

/**
 * Parse and validate a workflow definition from a JSONC file.
 * Returns null if invalid.
 */
export function parseWorkflowFile(
  filePath: string,
  scope: DiscoveredWorkflow["scope"]
): DiscoveredWorkflow | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    const raw = parseJsonc(content) as unknown

    const result = WorkflowDefinitionSchema.safeParse(raw)
    if (!result.success) {
      return null
    }

    return {
      definition: result.data as WorkflowDefinition,
      path: filePath,
      scope,
    }
  } catch {
    return null
  }
}

/**
 * Scan a directory for .jsonc and .json workflow files.
 */
function scanWorkflowDir(dir: string, scope: DiscoveredWorkflow["scope"]): DiscoveredWorkflow[] {
  if (!existsSync(dir)) return []

  const results: DiscoveredWorkflow[] = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry.endsWith(".jsonc") || entry.endsWith(".json")) {
        const fullPath = join(dir, entry)
        const workflow = parseWorkflowFile(fullPath, scope)
        if (workflow) {
          results.push(workflow)
        }
      }
    }
  } catch {
    // Permission denied or other FS error
  }

  return results
}

export interface DiscoverWorkflowsOptions {
  projectDirectory: string
  customDirs?: string[]
}

/**
 * Discover workflow definitions from:
 * 1. User: ~/.config/opencode/workflows/
 * 2. Project: {project}/.opencode/workflows/
 * 3. Custom dirs (from config)
 *
 * Later scopes override earlier ones by workflow name.
 */
export function discoverWorkflows(options: DiscoverWorkflowsOptions): DiscoveredWorkflow[] {
  const { projectDirectory, customDirs = [] } = options
  const byName = new Map<string, DiscoveredWorkflow>()

  // User workflows
  const userDir = join(homedir(), ".config", "opencode", "workflows")
  for (const wf of scanWorkflowDir(userDir, "user")) {
    byName.set(wf.definition.name, wf)
  }

  // Project workflows
  const projectDir = join(projectDirectory, ".opencode", "workflows")
  for (const wf of scanWorkflowDir(projectDir, "project")) {
    byName.set(wf.definition.name, wf)
  }

  // Custom dirs (treated as project scope, sandboxed via resolveSafePath)
  for (const customDir of customDirs) {
    const safePath = resolveSafePath(projectDirectory, customDir)
    if (!safePath) continue // path traversal attempt — skip silently
    for (const wf of scanWorkflowDir(safePath, "project")) {
      byName.set(wf.definition.name, wf)
    }
  }

  return Array.from(byName.values())
}
