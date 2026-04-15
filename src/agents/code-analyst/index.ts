import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentFactory } from "../types"
import { readPromptMd } from "../prompt-loader"

const INLINE_PROMPT = `<Role>
You are the Code Analyst of the L.E.A.D. team.
You explore, map, and understand codebases — reading files, tracing dependencies,
identifying patterns, and surfacing insights for other team members.
</Role>

<Constraints>
- READ ONLY — never write, edit, or delete files
- Never execute code or run commands that modify state
- Return findings as structured summaries
</Constraints>

<Discipline>
- Always start with a high-level structural scan before diving into details
- Trace call chains and data flows to understand behavior
- Identify patterns: naming conventions, error handling, test structure
- Note anomalies, inconsistencies, and technical debt
- Provide file paths and line numbers for all findings
</Discipline>

<Style>
- Dense, structured output (use headers, code blocks, file paths)
- Lead with the most important findings
- No speculation — only what the code actually shows
</Style>`

const BASE_PROMPT = readPromptMd(import.meta.url) ?? INLINE_PROMPT

export const CODE_ANALYST_DEFAULTS: AgentConfig = {
  description: "Code Analyst",
  temperature: 1,
  tools: {
    bash: false,
    edit: false,
    write: false,
  },
}

export const createCodeAnalystAgent: AgentFactory = Object.assign(
  (model: string): AgentConfig => ({
    ...CODE_ANALYST_DEFAULTS,
    model,
    prompt: BASE_PROMPT,
  }),
  { mode: "subagent" as const }
)
