import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import type { WorkState, PlanProgress } from "./types"
import { STATE_FILE } from "./constants"

/**
 * Read the active work state from .lead/state.json.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readWorkState(dir: string): WorkState | null {
  const filePath = join(dir, STATE_FILE)
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, "utf-8")
    return JSON.parse(raw) as WorkState
  } catch {
    return null
  }
}

/**
 * Write work state to .lead/state.json.
 * Creates the directory if it does not exist.
 */
export function writeWorkState(dir: string, state: WorkState): void {
  const filePath = join(dir, STATE_FILE)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(state, null, 2))
}

/**
 * Remove the active work state file.
 */
export function clearWorkState(dir: string): void {
  const filePath = join(dir, STATE_FILE)
  if (existsSync(filePath)) {
    try {
      const { unlinkSync } = require("fs") as typeof import("fs")
      unlinkSync(filePath)
    } catch {
      // ignore
    }
  }
}

/**
 * Count task checkboxes in ## Progress, ignoring detailed/verification checklists.
 * Older plans without that section retain their existing checklist format.
 * Returns PlanProgress with total, completed, and isComplete.
 */
export function getPlanProgress(planPath: string): PlanProgress {
  if (!existsSync(planPath)) {
    return { total: 0, completed: 0, isComplete: false }
  }

  try {
    const content = readFileSync(planPath, "utf-8")
    // Fenced examples are not task status (including headings inside examples).
    let fence: string | undefined
    const lines = content.split(/\r?\n/).filter((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
      if (fence) {
        if (marker && marker[1]![0] === fence[0] && marker[1]!.length >= fence.length && line.trim() === marker[1]) {
          fence = undefined
        }
        return false
      }
      if (marker) {
        fence = marker[1]
        return false
      }
      return true
    })
    const progressStart = lines.findIndex((line) => /^\s{0,3}##[ \t]+Progress(?:[ \t]+#+)?[ \t]*$/i.test(line))
    let taskLines = lines
    if (progressStart !== -1) {
      const afterHeading = lines.slice(progressStart + 1)
      const nextSection = afterHeading.findIndex((line) => /^\s{0,3}#{1,2}(?:[ \t]+|$)/.test(line))
      taskLines = nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection)
    }
    const checkboxes = taskLines.flatMap((line) => {
      const match = line.match(/^\s*-\s+\[([ x])\](?:\s+|$)/i)
      return match ? [match[1]!.toLowerCase()] : []
    })
    const unchecked = checkboxes.filter((status) => status === " ").length
    const checked = checkboxes.filter((status) => status === "x").length
    const total = unchecked + checked

    return {
      total,
      completed: checked,
      isComplete: total === 0 || checked === total,
    }
  } catch {
    return { total: 0, completed: 0, isComplete: false }
  }
}
