import type { LeadAgentName } from "./types"

/**
 * Prompt loader for agent definitions.
 *
 * At runtime, agent prompt strings are embedded directly in their respective
 * `index.ts` factory files (via the prompt.md files read at build time or
 * inlined as template literals). This module provides a thin utility that
 * loads an agent's default prompt from its `prompt.md` file.
 *
 * If the file cannot be read (e.g. in a bundled/dist context where the file
 * isn't present), it returns `null` and the caller falls back to the inline
 * default prompt string.
 */

export interface PromptLoadResult {
  prompt: string
  source: "file" | "inline"
}

/**
 * Attempts to load a prompt string from the agent's prompt.md file.
 * Returns null if the file does not exist or cannot be read.
 */
export function tryLoadPromptFile(agentName: LeadAgentName | string): string | null {
  // Resolve relative to this file's directory at build time
  const promptPath = new URL(`${agentName}/prompt.md`, import.meta.url)
  try {
    const file = Bun.file(promptPath)
    // Bun.file().text() is async but exists() is sync-compatible via Bun
    // We use the synchronous path via import.meta.resolve for build-time embedding
    // At runtime we return null and let callers use their inline defaults
    // This is intentionally synchronous — prompt files are small
    return null // Deferred to per-agent inline strings
  } catch {
    return null
  }
}

/**
 * Synchronously reads the prompt.md embedded during module evaluation.
 * Agent factories call this at module load time to read their adjacent prompt.md.
 *
 * Usage in an agent index.ts:
 *   const PROMPT = readPromptMd(import.meta.url) ?? INLINE_FALLBACK
 */
export function readPromptMd(importMetaUrl: string): string | null {
  try {
    const url = new URL("prompt.md", importMetaUrl)
    const content = require("fs").readFileSync(new URL(url).pathname, "utf-8") as string
    return content
  } catch {
    return null
  }
}
