export interface LoadedSkill {
  name: string
  content: string
  source: "api" | "user" | "project" | "custom"
  metadata?: {
    description?: string
    model?: string
    tools?: string[]
  }
}

export interface SkillLoadResult {
  skills: LoadedSkill[]
  errors: string[]
}
