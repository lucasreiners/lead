import { describe, it, expect } from "bun:test"
import { validatePlanFile } from "./validation"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const VALID_PLAN = `# My Plan

## TL;DR
> Summary: Test plan

## Objectives

### Core Objective
Build something

## TODOs

- [ ] Task 1
- [x] Task 2

## Verification

- [ ] Tests pass
`

describe("validatePlanFile", () => {
  it("returns invalid for non-existent file", () => {
    const result = validatePlanFile("/does/not/exist.md")
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.severity === "error")).toBe(true)
  })

  it("returns valid for well-formed plan", () => {
    const dir = join(tmpdir(), `val-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const planPath = join(dir, "plan.md")
    writeFileSync(planPath, VALID_PLAN)

    const result = validatePlanFile(planPath)
    expect(result.valid).toBe(true)
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0)

    rmSync(dir, { recursive: true, force: true })
  })

  it("warns about missing sections", () => {
    const dir = join(tmpdir(), `val-missing-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const planPath = join(dir, "plan.md")
    writeFileSync(planPath, "# Minimal\n\n- [ ] Task 1\n")

    const result = validatePlanFile(planPath)
    const warnings = result.issues.filter((i) => i.severity === "warning")
    expect(warnings.length).toBeGreaterThan(0)

    rmSync(dir, { recursive: true, force: true })
  })

  it("errors when no checkboxes present", () => {
    const dir = join(tmpdir(), `val-nochk-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const planPath = join(dir, "plan.md")
    writeFileSync(planPath, `## TL;DR\n\n## Objectives\n\n## TODOs\n\nNo tasks.\n\n## Verification\n`)

    const result = validatePlanFile(planPath)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.message.includes("checkboxes"))).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })
})
