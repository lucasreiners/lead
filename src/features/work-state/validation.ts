import { existsSync, readFileSync } from "fs"
import type { PlanValidationResult, PlanValidationIssue } from "./validation-types"

const REQUIRED_SECTIONS = ["## TL;DR", "## Objectives", "## TODOs", "## Verification"]

/**
 * Validate a plan markdown file.
 * Checks for required sections and at least one checkbox.
 */
export function validatePlanFile(path: string): PlanValidationResult {
  const issues: PlanValidationIssue[] = []

  if (!existsSync(path)) {
    issues.push({ severity: "error", message: `Plan file does not exist: ${path}` })
    return { valid: false, issues }
  }

  let content: string
  try {
    content = readFileSync(path, "utf-8")
  } catch (err) {
    issues.push({ severity: "error", message: `Cannot read plan file: ${String(err)}` })
    return { valid: false, issues }
  }

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      issues.push({ severity: "warning", message: `Missing section: ${section}` })
    }
  }

  // Check for at least one checkbox
  const hasCheckboxes = /- \[[ x]\]/i.test(content)
  if (!hasCheckboxes) {
    issues.push({ severity: "error", message: "Plan has no task checkboxes (- [ ] or - [x])" })
  }

  const hasErrors = issues.some((i) => i.severity === "error")
  return { valid: !hasErrors, issues }
}
