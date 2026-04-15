import { deny, allow } from "../domain/policy/policy-result"
import type { PolicyResult } from "../domain/policy/policy-result"

/**
 * Architect md-only guard.
 * Enforces that the architect agent only writes `.md` files in the `.lead/` directory.
 * This ensures architect stays in its planning lane and doesn't modify code.
 */

const ARCHITECT_AGENT = "architect"
const ALLOWED_DIR = ".lead/"
const WRITE_TOOLS = new Set(["write", "Write", "edit", "Edit"])

export interface ArchitectGuardInput {
  toolName: string
  args: Record<string, unknown>
  agentName?: string
}

/**
 * Check if an architect tool call violates the md-only rule.
 * Returns deny if architect tries to write outside .lead/ or to non-.md files.
 */
export function checkArchitectWrite(input: ArchitectGuardInput): PolicyResult {
  const { toolName, args, agentName } = input

  // Only applies to architect agent
  if (agentName !== ARCHITECT_AGENT) {
    return allow()
  }

  // Only applies to write/edit tools
  if (!WRITE_TOOLS.has(toolName)) {
    return allow()
  }

  const filePath = (args["path"] as string) || (args["filePath"] as string) || ""

  if (!filePath) {
    return allow()
  }

  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, "/")

  // Must be a .md file
  if (!normalizedPath.endsWith(".md")) {
    return deny(
      `Architect agent may only write Markdown (.md) files in the ${ALLOWED_DIR} directory. Attempted: ${filePath}`,
      { toolName, filePath },
    )
  }

  // Must be in .lead/ directory
  if (
    !normalizedPath.includes(ALLOWED_DIR) &&
    !normalizedPath.includes("/" + ALLOWED_DIR.replace(/\/$/, ""))
  ) {
    return deny(
      `Architect agent may only write files in the ${ALLOWED_DIR} directory. Attempted: ${filePath}`,
      { toolName, filePath },
    )
  }

  return allow()
}
