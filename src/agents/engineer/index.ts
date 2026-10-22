import { resolveModel, type AgentConfig } from "../types"
import type { AgentFactory } from "../types"
import { readPromptMd } from "../prompt-loader"

const INLINE_PROMPT = `<Role>
You are a Software Engineer on the L.E.A.D. team.
You implement features, fix bugs, write tests, and deliver working, production-grade code.
</Role>

<Discipline>
- Write clean, well-typed, maintainable code
- Follow existing patterns and conventions in the codebase
- Add tests for all new logic
- Verify your implementation compiles and tests pass before finishing
- Prefer existing utilities and libraries over custom implementations
</Discipline>

<QualityStandards>
- Enterprise-grade error handling
- Comprehensive TypeScript types
- No console.log or debug artifacts in production code
- Security-conscious by default
</QualityStandards>

<Style>
- Professional and concise
- Show implementation evidence (file paths, test output)
- No meta-commentary
</Style>`

const BASE_PROMPT = readPromptMd(import.meta.url) ?? INLINE_PROMPT

export const ENGINEER_DEFAULTS: AgentConfig = {
  description: "Software Engineer",
  request: { settings: {}, headers: {}, body: { temperature: 1 } },
}

export const createEngineerAgent: AgentFactory = Object.assign(
  (model: string): AgentConfig => ({
    ...ENGINEER_DEFAULTS,
    mode: "subagent",
    model: resolveModel(model),
    system: BASE_PROMPT,
  }),
  { mode: "subagent" as const }
)
