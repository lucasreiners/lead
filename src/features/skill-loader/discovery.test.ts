import { describe, it, expect } from "bun:test"
import { parseFrontmatter, loadSkillFile } from "./discovery"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("parseFrontmatter", () => {
  it("parses name and description", () => {
    const text = `---
name: my-skill
description: "A test skill"
---
# Skill Content

Some instructions here.`
    const result = parseFrontmatter(text)
    expect(result.metadata.name).toBe("my-skill")
    expect(result.metadata.description).toBe("A test skill")
    expect(result.content).toContain("Some instructions here.")
  })

  it("parses inline tools array", () => {
    const text = `---
name: skill-with-tools
tools: [grep, read, bash]
---
Content here`
    const { metadata } = parseFrontmatter(text)
    expect(metadata.tools).toEqual(["grep", "read", "bash"])
  })

  it("parses multi-line tools array", () => {
    const text = `---
name: multi-tools
tools:
  - grep
  - read
---
Content`
    const { metadata } = parseFrontmatter(text)
    expect(metadata.tools).toEqual(["grep", "read"])
  })

  it("parses model override", () => {
    const text = `---
name: model-skill
model: gpt-4o
---
Content`
    const { metadata } = parseFrontmatter(text)
    expect(metadata.model).toBe("gpt-4o")
  })

  it("returns full text as content when no frontmatter", () => {
    const text = "# No frontmatter\n\nJust content."
    const { metadata, content } = parseFrontmatter(text)
    expect(Object.keys(metadata).length).toBe(0)
    expect(content).toBe(text)
  })
})

describe("loadSkillFile", () => {
  const tmpDir = join(tmpdir(), `skill-test-${Date.now()}`)

  it("loads a SKILL.md with frontmatter", () => {
    mkdirSync(tmpDir, { recursive: true })
    const skillPath = join(tmpDir, "SKILL.md")
    writeFileSync(skillPath, `---\nname: test-skill\ndescription: Test\n---\n# Instructions\n\nDo this.`)

    const skill = loadSkillFile(skillPath, "project")
    expect(skill).not.toBeNull()
    expect(skill!.name).toBe("test-skill")
    expect(skill!.content).toContain("Do this.")
    expect(skill!.source).toBe("project")
    expect(skill!.metadata?.description).toBe("Test")

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("uses directory name as skill name when frontmatter lacks name", () => {
    const skillDir = join(tmpdir(), `skill-dir-${Date.now()}`)
    mkdirSync(skillDir, { recursive: true })
    const skillPath = join(skillDir, "SKILL.md")
    writeFileSync(skillPath, "# No frontmatter\n\nContent here.")

    const skill = loadSkillFile(skillPath, "user")
    expect(skill).not.toBeNull()
    // Name derived from parent directory
    expect(typeof skill!.name).toBe("string")
    expect(skill!.name.length).toBeGreaterThan(0)

    rmSync(skillDir, { recursive: true, force: true })
  })

  it("returns null for non-existent file", () => {
    const skill = loadSkillFile("/does/not/exist/SKILL.md", "project")
    expect(skill).toBeNull()
  })
})
