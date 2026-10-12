import { readFileSync } from "node:fs"
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
 * Defers to per-agent inline prompts. Source prompt files are loaded by
 * readPromptMd() in each agent factory instead.
 */
export function tryLoadPromptFile(_agentName: LeadAgentName | string): string | null {
  return null
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
    const content = readFileSync(url, "utf-8")
    return content
  } catch {
    return null
  }
}
