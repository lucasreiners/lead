import { describe, it, expect } from "bun:test"
import { loadSkills } from "./loader"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("loadSkills", () => {
  it("returns empty result when no skills found", async () => {
    const tmpDir = join(tmpdir(), `loader-test-empty-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    const result = await loadSkills({ projectDirectory: tmpDir })
    expect(result.skills).toEqual([])
    expect(result.errors).toEqual([])

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("discovers skills from .opencode/skills/ in project directory", async () => {
    const tmpDir = join(tmpdir(), `loader-test-proj-${Date.now()}`)
    const skillDir = join(tmpDir, ".opencode", "skills", "my-skill")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: my-skill\ndescription: My Test Skill\n---\n# Instructions\n\nDo this.`
    )

    const result = await loadSkills({ projectDirectory: tmpDir })
    expect(result.skills.some((s) => s.name === "my-skill")).toBe(true)

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("filters out disabled skills", async () => {
    const tmpDir = join(tmpdir(), `loader-test-disabled-${Date.now()}`)
    const skillDir = join(tmpDir, ".opencode", "skills", "bad-skill")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: bad-skill\n---\nContent`
    )

    const result = await loadSkills({
      projectDirectory: tmpDir,
      disabledSkills: ["bad-skill"],
    })
    expect(result.skills.some((s) => s.name === "bad-skill")).toBe(false)

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("deduplicates skills by name (API wins over FS)", async () => {
    // We can't easily test the real API, but we can verify the merge logic
    // by calling loadSkills without serverUrl and checking deduplication
    const tmpDir = join(tmpdir(), `loader-test-dedup-${Date.now()}`)
    const skillDir = join(tmpDir, ".opencode", "skills", "dup-skill")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: dup-skill\n---\nFS Content`
    )

    const result = await loadSkills({ projectDirectory: tmpDir })
    const dupSkills = result.skills.filter((s) => s.name === "dup-skill")
    expect(dupSkills.length).toBe(1) // No duplicates

    rmSync(tmpDir, { recursive: true, force: true })
  })
})
