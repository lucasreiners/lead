import { readWorkState, writeWorkState } from "../features/work-state/storage"
import { STATE_DIR } from "../features/work-state/constants"

/**
 * Plan capture hook.
 * Fires after the architect writes a .md file inside .lead/.
 * Records the plan as the current active plan in state.json with paused=true,
 * so the user can review it before running /implement.
 */

const WRITE_TOOLS = new Set(["write", "Write", "edit", "Edit"])
const ARCHITECT_AGENT = "architect"

export interface PlanCaptureInput {
  toolName: string
  args: Record<string, unknown>
  agentName?: string
  sessionId: string
  directory: string
}

/**
 * Detect if a plan file was just written and capture it into state.json.
 * Only triggers when the architect writes a .md file inside .lead/.
 */
export function capturePlanWrite(input: PlanCaptureInput): void {
  const { toolName, args, agentName, sessionId, directory } = input

  // Only trigger for architect agent
  if (!agentName?.includes(ARCHITECT_AGENT)) return

  // Only trigger for write/edit tools
  if (!WRITE_TOOLS.has(toolName)) return

  const filePath = (args["filePath"] as string) || (args["path"] as string) || ""
  if (!filePath) return

  const normalized = filePath.replace(/\\/g, "/")

  // Must be a .md file inside .lead/
  if (!normalized.endsWith(".md")) return
  if (!normalized.includes(`/${STATE_DIR}/`) && !normalized.includes(`${STATE_DIR}/`)) return

  // Extract plan name from the first heading or fallback to filename
  const planName = extractPlanName(args["content"] as string | undefined, filePath)

  // Don't overwrite an active (non-paused) state for a different plan
  const existing = readWorkState(directory)
  if (existing && !existing.paused && existing.active_plan !== filePath) return

  writeWorkState(directory, {
    active_plan: filePath,
    started_at: existing?.started_at ?? new Date().toISOString(),
    session_ids: existing?.session_ids
      ? [...new Set([...existing.session_ids, sessionId])]
      : [sessionId],
    plan_name: planName,
    paused: true,
    continuation_completed_snapshot: 0,
    stale_continuation_count: 0,
  })
}

function extractPlanName(content: string | undefined, filePath: string): string {
  if (content) {
    const match = content.match(/^#\s+(.+)$/m)
    if (match?.[1]) return match[1].trim()
  }
  // Fallback: derive from path — e.g. .lead/PROJ-123/plan.md → PROJ-123
  const parts = filePath.replace(/\\/g, "/").split("/")
  const mdIdx = parts.findLastIndex((p) => p.endsWith(".md"))
  if (mdIdx > 0) {
    const parent = parts[mdIdx - 1]
    if (parent && parent !== STATE_DIR && parent !== "_adhoc") return parent
    if (parent === "_adhoc" && parts[mdIdx]) return parts[mdIdx].replace(/\.md$/, "")
  }
  return filePath
}
