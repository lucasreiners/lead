import type { LoadedSkill, SkillLoadResult } from "./types"
import type { ResolveSkillsFn } from "../../agents/agent-builder"

/**
 * Create a skill resolver from a SkillLoadResult.
 * Returns a ResolveSkillsFn closure that, when called with skill names
 * and an optional disabled set, returns concatenated skill content.
 */
export function createSkillResolver(loadResult: SkillLoadResult): ResolveSkillsFn {
  const skillMap = new Map<string, LoadedSkill>()
  for (const skill of loadResult.skills) {
    skillMap.set(skill.name, skill)
  }

  return (skillNames: string[], disabledSkills?: Set<string>): string => {
    const parts: string[] = []
    for (const name of skillNames) {
      if (disabledSkills?.has(name)) continue
      const skill = skillMap.get(name)
      if (skill?.content) {
        parts.push(skill.content)
      }
    }
    return parts.join("\n\n")
  }
}
