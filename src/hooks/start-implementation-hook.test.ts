import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test"
import { build } from "bun"
import { handleStartImplementation, type StartImplementationOptions, type StartImplementationResult } from "./start-implementation-hook"
import { readWorkState, writeWorkState } from "../features/work-state/storage"
import { dirname, join } from "node:path"
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

let TEST_DIR: string
let bundleDir: string
let bundlePath: string

beforeAll(async () => {
  bundleDir = mkdtempSync(join(tmpdir(), "lead-start-implementation-node-"))
  bundlePath = join(bundleDir, "hook.mjs")
  const result = await build({
    entrypoints: [fileURLToPath(new URL("./start-implementation-hook.ts", import.meta.url))],
    target: "node",
    format: "esm",
  })
  if (!result.success) throw new Error(`Node test bundle failed: ${result.logs.join("\n")}`)
  writeFileSync(bundlePath, await result.outputs[0]!.text())
})

afterAll(() => {
  rmSync(bundleDir, { recursive: true, force: true })
})

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "lead-test-start-implementation-"))
})

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

function startInNode(options: StartImplementationOptions): StartImplementationResult {
  const script = `
    import { handleStartImplementation } from ${JSON.stringify(pathToFileURL(bundlePath).href)};
    if (typeof globalThis.Bun !== "undefined") throw new Error("Expected a Node host without Bun");
    console.log(JSON.stringify(await handleStartImplementation(${JSON.stringify(options)})));
  `
  return JSON.parse(execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf-8" }))
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

  it.each([
    ["absolute path", "external/absolute.md", "absolute"],
    ["relative path", "docs/relative.md", "docs/relative.md"],
    ["ticket", ".lead/PROJ-42/plan.md", "PROJ-42"],
    ["ad-hoc name", ".lead/_adhoc/feature.md", "feature"],
    ["ad-hoc filename", ".lead/_adhoc/feature.md", "feature.md"],
    ["partial filename", ".lead/plans/deep/My-Feature-Plan.md", "FEATURE"],
    ["partial ticket", ".lead/PROJ-42/deep/plan.md", "proj-4"],
    ["root Markdown file", ".lead/root-plan.md", "ROOT"],
  ])("discovers by %s without a Bun global", async (_label, relativePath, input) => {
    const planPath = join(TEST_DIR, relativePath)
    mkdirSync(dirname(planPath), { recursive: true })
    writeFileSync(planPath, "# Discovered Plan\n\n## Progress\n- [x] Finished\n- [ ] Pending\n")

    const result = startInNode({
      args: input === "absolute" ? planPath : input,
      sessionId: "node-session",
      directory: TEST_DIR,
      startSha: "abc123",
    })

    expect(result.error).toBeUndefined()
    expect(result.prompt).toContain("Discovered Plan")
    expect(result.prompt).toContain("1/2 tasks complete")
    expect(result.prompt).toContain("FIRST action MUST be to **Read** the plan file")
    expect(result.prompt).toContain("Keep the checkbox unchecked until verification returns [PASS]")
    expect(result.prompt).not.toMatch(/todowrite|seed|\[pending\]/i)
    expect(readWorkState(TEST_DIR)).toMatchObject({
      active_plan: planPath,
      plan_name: "Discovered Plan",
      session_ids: ["node-session"],
      start_sha: "abc123",
      paused: false,
    })
  })

  it("preserves direct, ticket, then ad-hoc discovery precedence", async () => {
    const candidates = [
      join(TEST_DIR, "feature"),
      join(TEST_DIR, ".lead", "feature", "plan.md"),
      join(TEST_DIR, ".lead", "_adhoc", "feature.md"),
    ]
    for (const planPath of candidates) {
      mkdirSync(dirname(planPath), { recursive: true })
      writeFileSync(planPath, "# Plan\n- [ ] Task\n")
    }
    setupTestPlan("feature-fallback", "# Fallback\n")

    for (const planPath of candidates) {
      const result = startInNode({
        args: "feature",
        sessionId: "node-session",
        directory: TEST_DIR,
      })
      expect(result.error).toBeUndefined()
      expect(readWorkState(TEST_DIR)?.active_plan).toBe(planPath)
      rmSync(planPath)
    }
  })

  it.each([false, true])("resumes from the plan on disk and enrolls an explicit session (paused=%s)", async (paused) => {
    const planPath = setupTestPlan("resume", "# Resume\n## Progress\n- [ ] First\n- [ ] Second\n")
    writeWorkState(TEST_DIR, {
      active_plan: planPath,
      started_at: "2026-01-01T00:00:00Z",
      session_ids: ["original-session"],
      plan_name: "Resume",
      paused,
      stale_continuation_count: 3,
    })
    writeFileSync(planPath, "# Resume\n## Progress\n- [x] First\n- [ ] Second\n## TODOs\n- [ ] Duplicate detail\n")

    const result = startInNode({ args: "", sessionId: "resuming-session", directory: TEST_DIR })

    expect(result.prompt).toContain("1/2 tasks complete")
    expect(result.prompt).toContain("FIRST action MUST be to **Read** the plan file")
    expect(result.prompt).toContain("Keep the checkbox unchecked until verification returns [PASS]")
    expect(result.prompt).toContain("## TODOs")
    expect(result.prompt).not.toMatch(/todowrite|seed|\[pending\]/i)
    expect(readWorkState(TEST_DIR)).toMatchObject({
      session_ids: ["original-session", "resuming-session"],
      paused: false,
      stale_continuation_count: 0,
    })
  })

  it("excludes hidden files, non-Markdown files, directories, and symlinks from discovery", async () => {
    for (const relativePath of [
      ".lead/.hidden/needle.md",
      ".lead/plans/.needle.md",
      ".lead/plans/needle.txt",
      ".lead/plans/needle.MD",
    ]) {
      const planPath = join(TEST_DIR, relativePath)
      mkdirSync(dirname(planPath), { recursive: true })
      writeFileSync(planPath, "# Should not be discovered\n")
    }
    mkdirSync(join(TEST_DIR, ".lead", "plans", "needle-directory.md"))
    const target = setupTestPlan("target", "# Target\n")
    symlinkSync(target, join(TEST_DIR, ".lead", "plans", "needle-link.md"))

    const result = startInNode({
      args: "needle",
      sessionId: "node-session",
      directory: TEST_DIR,
    })

    expect(result.prompt).toBeNull()
    expect(result.error).toContain("Plan not found")
    expect(readWorkState(TEST_DIR)).toBeNull()
  })
})
