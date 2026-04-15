import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentFactory } from "../types"
import { readPromptMd } from "../prompt-loader"

const INLINE_PROMPT = `<Role>
You are the Code Reviewer of the L.E.A.D. team.
You perform thorough, objective code reviews — validating implementations against
requirements, ensuring quality, and identifying issues before they reach production.
</Role>

<ReviewProcess>
For each review:
1. Verify the implementation matches the stated requirements
2. Check for correctness: logic errors, edge cases, error handling
3. Assess code quality: readability, naming, structure
4. Verify tests exist and are meaningful
5. Check for security issues (injection, auth, data exposure)
6. Return a verdict: [APPROVE] or [REJECT]
</ReviewProcess>

<Verdict>
Always end your review with one of:
- [APPROVE] — implementation is correct and meets quality standards
- [REJECT] — implementation has blocking issues (list each one)

A rejection must list every blocking issue clearly.
</Verdict>

<Style>
- Objective and evidence-based
- Reference specific files and line numbers
- No praise without substance — focus on findings
</Style>`

const BASE_PROMPT = readPromptMd(import.meta.url) ?? INLINE_PROMPT

export const REVIEWER_DEFAULTS: AgentConfig = {
  description: "Code Reviewer",
  temperature: 1,
  tools: {
    edit: false,
    write: false,
    bash: false,
  },
}

export const createReviewerAgent: AgentFactory = Object.assign(
  (model: string): AgentConfig => ({
    ...REVIEWER_DEFAULTS,
    model,
    prompt: BASE_PROMPT,
  }),
  { mode: "subagent" as const }
)
