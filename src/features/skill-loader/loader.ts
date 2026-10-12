import type { LoadedSkill, SkillLoadResult } from "./types"
import { discoverSkillsFromDirs } from "./discovery"

export interface LoadSkillsOptions {
  /** Use the host's authenticated, location-scoped V2 skill catalog. */
  fetchSkills?: () => Promise<LoadedSkill[]>
  projectDirectory: string
  customDirs?: string[]
  disabledSkills?: string[]
}

/**
 * Orchestrate skill loading:
 * 1. Read the host's skill catalog
 * 2. Fallback to filesystem discovery
 * 3. Deduplicate by name (API wins)
 * 4. Filter disabled skills
 */
export async function loadSkills(options: LoadSkillsOptions): Promise<SkillLoadResult> {
  const {
    fetchSkills,
    projectDirectory,
    customDirs = [],
    disabledSkills = [],
  } = options

  const errors: string[] = []
  const disabledSet = new Set(disabledSkills)

  // Step 1: Try API
  let apiSkills: LoadedSkill[] = []
  if (fetchSkills) {
    try {
      apiSkills = await fetchSkills()
    } catch (err) {
      errors.push(`API skill fetch failed: ${String(err)}`)
    }
  }

  // Step 2: Filesystem discovery
  let fsSkills: LoadedSkill[] = []
  try {
    fsSkills = discoverSkillsFromDirs({ projectDirectory, customDirs })
  } catch (err) {
    errors.push(`Filesystem skill discovery failed: ${String(err)}`)
  }

  // Step 3: Merge (API takes precedence, dedup by name)
  const merged = new Map<string, LoadedSkill>()

  // Add FS skills first (lower priority)
  for (const skill of fsSkills) {
    merged.set(skill.name, skill)
  }

  // API skills override (higher priority)
  for (const skill of apiSkills) {
    merged.set(skill.name, skill)
  }

  // Step 4: Filter disabled
  const skills: LoadedSkill[] = []
  for (const skill of merged.values()) {
    if (!disabledSet.has(skill.name)) {
      skills.push(skill)
    }
  }

  return { skills, errors }
}
