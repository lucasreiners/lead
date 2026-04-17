import { deny, allow } from "../domain/policy/policy-result"
import type { PolicyResult } from "../domain/policy/policy-result"

/**
 * Architect md-only guard.
 * Enforces that architect and product-owner agents only write `.md` files in the `.lead/` directory.
 * This ensures planning agents stay in their lane and don't modify code.
 */

const MD_ONLY_AGENTS = new Set(["architect", "product-owner"])
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

  // Only applies to md-only agents (architect, product-owner)
  if (!agentName || !MD_ONLY_AGENTS.has(agentName)) {
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
      `${agentName} agent may only write Markdown (.md) files in the ${ALLOWED_DIR} directory. Attempted: ${filePath}`,
      { toolName, filePath },
    )
  }

  // Must be in .lead/ directory
  if (
    !normalizedPath.includes(ALLOWED_DIR) &&
    !normalizedPath.includes("/" + ALLOWED_DIR.replace(/\/$/, ""))
  ) {
    return deny(
      `${agentName} agent may only write files in the ${ALLOWED_DIR} directory. Attempted: ${filePath}`,
      { toolName, filePath },
    )
  }

  return allow()
}
