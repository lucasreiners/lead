import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { loadLeadConfig } from "./loader"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("loadLeadConfig", () => {
  let testDir: string
  let fakeHome: string

  beforeEach(() => {
    testDir = join(tmpdir(), `lead-test-${Date.now()}`)
    fakeHome = join(tmpdir(), `lead-home-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(fakeHome, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
    if (existsSync(fakeHome)) rmSync(fakeHome, { recursive: true })
  })

  it("returns empty config when no files exist", () => {
    const config = loadLeadConfig(testDir, { homeDir: fakeHome })
    expect(config).toEqual({})
  })

  it("loads project config from .opencode/lead.jsonc", () => {
    const configDir = join(testDir, ".opencode")
    mkdirSync(configDir)
    writeFileSync(
      join(configDir, "lead.jsonc"),
      JSON.stringify({ log_level: "DEBUG", disabled_agents: ["architect"] }),
    )
    const config = loadLeadConfig(testDir, { homeDir: fakeHome })
    expect(config.log_level).toBe("DEBUG")
    expect(config.disabled_agents).toEqual(["architect"])
  })

  it("loads JSONC with comments and trailing commas", () => {
    const configDir = join(testDir, ".opencode")
    mkdirSync(configDir)
    writeFileSync(
      join(configDir, "lead.jsonc"),
      `{
        // This is a comment
        "log_level": "WARN", // inline comment
        "disabled_agents": ["code-analyst",], // trailing comma
      }`,
    )
    const config = loadLeadConfig(testDir, { homeDir: fakeHome })
    expect(config.log_level).toBe("WARN")
    expect(config.disabled_agents).toEqual(["code-analyst"])
  })

  it("merges user and project configs", () => {
    // User config
    const userConfigDir = join(fakeHome, ".config", "opencode")
    mkdirSync(userConfigDir, { recursive: true })
    writeFileSync(join(userConfigDir, "lead.jsonc"), JSON.stringify({ log_level: "DEBUG" }))

    // Project config
    const projectConfigDir = join(testDir, ".opencode")
    mkdirSync(projectConfigDir)
    writeFileSync(
      join(projectConfigDir, "lead.jsonc"),
      JSON.stringify({ log_level: "ERROR", disabled_tools: ["bash"] }),
    )

    const config = loadLeadConfig(testDir, { homeDir: fakeHome })
    expect(config.log_level).toBe("ERROR") // project wins
    expect(config.disabled_tools).toEqual(["bash"])
  })
})
