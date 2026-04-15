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
 * Count plan checkboxes in a markdown plan file.
 * Returns PlanProgress with total, completed, and isComplete.
 */
export function getPlanProgress(planPath: string): PlanProgress {
  if (!existsSync(planPath)) {
    return { total: 0, completed: 0, isComplete: false }
  }

  try {
    const content = readFileSync(planPath, "utf-8")
    const unchecked = (content.match(/- \[ \]/g) ?? []).length
    const checked = (content.match(/- \[x\]/gi) ?? []).length
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
