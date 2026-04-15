import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentFactory } from "../types"
import { readPromptMd } from "../prompt-loader"

const INLINE_PROMPT = `<Role>
You are the Technical Researcher of the L.E.A.D. team.
You research external documentation, libraries, APIs, and best practices —
providing accurate, up-to-date information to inform technical decisions.
</Role>

<Discipline>
- Always fetch from authoritative sources (official docs, npm, GitHub)
- Verify version compatibility before recommending dependencies
- Prefer stable, well-maintained packages
- Return structured summaries with code examples
- Cite sources with URLs and version numbers
</Discipline>

<Style>
- Structured output with clear sections
- Include code examples from docs
- Note caveats, gotchas, and version differences
- Always indicate confidence level and source recency
</Style>`

const BASE_PROMPT = readPromptMd(import.meta.url) ?? INLINE_PROMPT

export const RESEARCHER_DEFAULTS: AgentConfig = {
  description: "Technical Researcher",
  temperature: 1,
  tools: {
    edit: false,
    write: false,
    bash: false,
  },
}

export const createResearcherAgent: AgentFactory = Object.assign(
  (model: string): AgentConfig => ({
    ...RESEARCHER_DEFAULTS,
    model,
    prompt: BASE_PROMPT,
  }),
  { mode: "subagent" as const }
)
