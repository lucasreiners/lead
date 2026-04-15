import { join } from "path"
import { resolveSafePath } from "../shared/resolve-safe-path"

/**
 * Rules injector.
 * Injects content from `.opencode/rules/` into tool execution context for relevant files.
 * Rules files use glob-like patterns in their names to match target files.
 */

const RULES_DIR = ".opencode/rules"

export interface RulesInjectorResult {
  /** Combined rules content to inject */
  content: string
  /** Paths of rules files that matched */
  matchedRules: string[]
}

/**
 * Check if a tool/file combination should receive rules injection.
 * Rules are injected for file-reading and file-writing tools.
 */
export function shouldInjectRules(toolName: string, _filePath?: string): boolean {
  const fileTools = new Set([
    "read",
    "Read",
    "write",
    "Write",
    "edit",
    "Edit",
    "bash",
    "Bash",
  ])
  return fileTools.has(toolName)
}

/**
 * Get rules content matching the given file path from the rules directory.
 * Rules files in `.opencode/rules/` with names that match the file's extension or path.
 */
export async function getRulesForFile(
  filePath: string,
  directory: string,
): Promise<RulesInjectorResult> {
  const rulesDir = join(directory, RULES_DIR)
  const matchedRules: string[] = []
  const contentParts: string[] = []

  let entries: string[]
  try {
    const glob = new Bun.Glob("**/*.md")
    entries = await Array.fromAsync(glob.scan(rulesDir))
  } catch {
    // Rules dir doesn't exist or can't be read
    return { content: "", matchedRules: [] }
  }

  for (const entry of entries) {
    // Safe path resolution
    const resolved = resolveSafePath(rulesDir, entry)
    if (!resolved) continue

    // Check if this rule applies to the file
    const ruleBasename = entry.toLowerCase()
    const fileBasename = filePath.toLowerCase()

    const applies =
      ruleBasename.includes("always") ||
      ruleBasename.includes("global") ||
      fileBasename.endsWith(ruleBasename.replace(".md", "")) ||
      (ruleBasename.includes("typescript") && (fileBasename.endsWith(".ts") || fileBasename.endsWith(".tsx"))) ||
      (ruleBasename.includes("test") && fileBasename.includes(".test.")) ||
      (ruleBasename.includes("javascript") && (fileBasename.endsWith(".js") || fileBasename.endsWith(".jsx")))

    if (applies) {
      try {
        const content = await Bun.file(resolved).text()
        if (content.trim()) {
          contentParts.push(content.trim())
          matchedRules.push(resolved)
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return {
    content: contentParts.join("\n\n---\n\n"),
    matchedRules,
  }
}
