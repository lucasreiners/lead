import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { join, resolve } from "path"
import { homedir } from "os"
import type { LoadedSkill } from "./types"
import { resolveSafePath } from "../../shared/resolve-safe-path"

interface SkillFrontmatter {
  name?: string
  description?: string
  model?: string
  tools?: string | string[]
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Manual parsing — no external YAML dependency.
 */
export function parseFrontmatter(text: string): {
  metadata: SkillFrontmatter
  content: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!match) {
    return { metadata: {}, content: text }
  }

  const frontmatter = match[1]
  const content = match[2]
  const metadata: SkillFrontmatter = {}

  const lines = frontmatter.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) {
      i++
      continue
    }

    const key = line.slice(0, colonIdx).trim() as keyof SkillFrontmatter
    const rawValue = line.slice(colonIdx + 1).trim()

    if (rawValue.startsWith("[")) {
      // Inline array: [item1, item2]
      const inner = rawValue.slice(1, rawValue.lastIndexOf("]"))
      const items = inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
      if (key === "tools") {
        metadata.tools = items
      }
      i++
      continue
    }

    if (rawValue === "") {
      // Multi-line array (YAML block sequence)
      const items: string[] = []
      i++
      while (i < lines.length && lines[i].trim().startsWith("-")) {
        items.push(lines[i].trim().slice(1).trim())
        i++
      }
      if (key === "tools") {
        metadata.tools = items
      }
      continue
    }

    // Scalar value
    const value = rawValue.replace(/^["']|["']$/g, "")
    if (key === "name" || key === "description" || key === "model") {
      metadata[key] = value
    } else if (key === "tools") {
      metadata.tools = [value]
    }
    i++
  }

  return { metadata, content }
}

/**
 * Load a single SKILL.md file as a LoadedSkill.
 * Returns null if the file cannot be read or lacks a name.
 */
export function loadSkillFile(
  filePath: string,
  source: LoadedSkill["source"]
): LoadedSkill | null {
  try {
    const text = readFileSync(filePath, "utf-8")
    const { metadata, content } = parseFrontmatter(text)

    // Derive name from frontmatter or parent directory
    const name =
      metadata.name ??
      filePath
        .split(/[\\/]/)
        .slice(-2, -1)[0] // parent directory name
        ?.replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase()

    if (!name) return null

    // Normalize tools
    const tools =
      metadata.tools == null
        ? undefined
        : Array.isArray(metadata.tools)
          ? metadata.tools
          : [metadata.tools]

    return {
      name,
      content: content.trim(),
      source,
      metadata: {
        description: metadata.description,
        model: metadata.model,
        tools,
      },
    }
  } catch {
    return null
  }
}

/**
 * Recursively scan a directory for SKILL.md files.
 */
export function scanDirectory(
  dir: string,
  source: LoadedSkill["source"]
): LoadedSkill[] {
  if (!existsSync(dir)) return []
  const skills: LoadedSkill[] = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        // Check for SKILL.md inside this subdirectory
        const skillPath = join(fullPath, "SKILL.md")
        if (existsSync(skillPath)) {
          const skill = loadSkillFile(skillPath, source)
          if (skill) skills.push(skill)
        }
        // Recurse into subdirectory as well
        skills.push(...scanDirectory(fullPath, source))
      } else if (entry === "SKILL.md") {
        const skill = loadSkillFile(fullPath, source)
        if (skill) skills.push(skill)
      }
    }
  } catch {
    // Permission denied or other FS error — skip silently
  }

  return skills
}

export interface DiscoverSkillsOptions {
  projectDirectory: string
  customDirs?: string[]
}

/**
 * Discover skills from filesystem:
 * 1. User skills: ~/.config/opencode/skills/
 * 2. Project skills: {projectDirectory}/.opencode/skills/
 * 3. Custom dirs from config (sandboxed via resolveSafePath)
 */
export function discoverSkillsFromDirs(
  options: DiscoverSkillsOptions
): LoadedSkill[] {
  const { projectDirectory, customDirs = [] } = options
  const results: LoadedSkill[] = []

  // User skills
  const userSkillsDir = join(homedir(), ".config", "opencode", "skills")
  results.push(...scanDirectory(userSkillsDir, "user"))

  // Project skills
  const projectSkillsDir = join(projectDirectory, ".opencode", "skills")
  results.push(...scanDirectory(projectSkillsDir, "project"))

  // Custom dirs — sandboxed relative to project
  for (const customDir of customDirs) {
    try {
      const safeDir = resolveSafePath(projectDirectory, customDir)
      const fullPath = resolve(projectDirectory, safeDir)
      results.push(...scanDirectory(fullPath, "custom"))
    } catch {
      // Traversal attempt — skip
    }
  }

  return results
}
