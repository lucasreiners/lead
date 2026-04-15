import { describe, it, expect, afterEach } from "bun:test"
import { handleStartImplementation } from "./start-implementation-hook"
import { clearWorkState, readWorkState } from "../features/work-state/storage"
import { join } from "path"
import { mkdirSync, writeFileSync, rmSync } from "fs"

const TEST_DIR = "/tmp/lead-test-start-implementation"

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true })
  } catch {
    // ignore
  }
})

function setupTestPlan(name: string, content: string): string {
  const plansDir = join(TEST_DIR, ".lead", "plans")
  mkdirSync(plansDir, { recursive: true })
  const planPath = join(plansDir, `${name}.md`)
  writeFileSync(planPath, content)
  return planPath
}

describe("handleStartImplementation", () => {
  it("returns error when no args and no active plan", async () => {
    mkdirSync(TEST_DIR, { recursive: true })
    const result = await handleStartImplementation({
      args: "",
      sessionId: "session-1",
      directory: TEST_DIR,
    })
    expect(result.prompt).toBeNull()
    expect(result.error).toContain("No plan specified")
  })

  it("returns error when plan not found", async () => {
    mkdirSync(TEST_DIR, { recursive: true })
    const result = await handleStartImplementation({
      args: "nonexistent-plan",
      sessionId: "session-1",
      directory: TEST_DIR,
    })
    expect(result.prompt).toBeNull()
    expect(result.error).toContain("Plan not found")
  })

  it("creates work state and returns prompt when plan found", async () => {
    const planContent = `# Test Plan

## TL;DR
> Summary: Test

## TODOs
- [ ] 1. Do something
- [ ] 2. Do something else
`
    setupTestPlan("my-plan", planContent)

    const result = await handleStartImplementation({
      args: "my-plan",
      sessionId: "session-1",
      directory: TEST_DIR,
    })

    expect(result.prompt).not.toBeNull()
    expect(result.prompt).toContain("Test Plan")
    expect(result.error).toBeUndefined()

    // Verify work state was written
    const state = readWorkState(TEST_DIR)
    expect(state).not.toBeNull()
    expect(state?.plan_name).toBe("Test Plan")
    expect(state?.session_ids).toContain("session-1")
  })
})
