import { existsSync, readdirSync } from "fs"
import { join } from "path"
import { getPlanProgress } from "../work-state/storage"
import type { CompletionContext, CompletionCheckResult, CompletionMethod } from "./types"
import { WORKFLOW_STEP_COMPLETE_SIGNAL } from "./constants"

const DEFAULT_USER_CONFIRM_KEYWORDS = [
  "confirmed",
  "approved",
  "continue",
  "done",
  "let's proceed",
  "looks good",
  "lgtm",
]

function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}

/**
 * Check if the current workflow step is complete based on its completion method.
 */
export function checkStepCompletion(
  method: CompletionMethod,
  ctx: CompletionContext
): CompletionCheckResult {
  switch (method) {
    case "user_confirm": {
      const keywords = ctx.config.keywords?.length
        ? ctx.config.keywords
        : DEFAULT_USER_CONFIRM_KEYWORDS
      const msg = ctx.lastUserMessage ?? ""
      if (containsKeyword(msg, keywords)) {
        return {
          complete: true,
          summary: `User confirmed: "${msg.slice(0, 80)}"`,
        }
      }
      return { complete: false }
    }

    case "plan_created": {
      const planName = ctx.config.plan_name
      if (!planName) return { complete: false }

      // Check for plan file in ticket dirs and _adhoc
      const leadDir = join(ctx.directory, ".lead")
      if (!existsSync(leadDir)) return { complete: false }

      let found: string | null = null
      try {
        // Search ticket dirs (.lead/<ticket>/plan.md)
        const entries = readdirSync(leadDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== "_adhoc" && entry.name !== "workflow") {
            const ticketPlan = join(leadDir, entry.name, "plan.md")
            if (existsSync(ticketPlan)) {
              found = ticketPlan
              break
            }
          }
        }

        // Search _adhoc dir
        if (!found) {
          const adhocDir = join(leadDir, "_adhoc")
          if (existsSync(adhocDir)) {
            const adhocEntries = readdirSync(adhocDir)
            for (const e of adhocEntries) {
              if (e === `${planName}.md` || e.includes(planName)) {
                found = join(adhocDir, e)
                break
              }
            }
          }
        }
      } catch {
        return { complete: false }
      }

      if (found) {
        return {
          complete: true,
          artifacts: { plan_path: found },
          summary: `Plan created at: ${found}`,
        }
      }
      return { complete: false }
    }

    case "plan_complete": {
      const planName = ctx.config.plan_name
      if (!planName) return { complete: false }

      const plansDir = join(ctx.directory, ".lead", "plans")
      if (!existsSync(plansDir)) return { complete: false }

      let planPath: string | null = null
      try {
        const entries = readdirSync(plansDir)
        for (const entry of entries) {
          if (entry === `${planName}.md` || entry.includes(planName)) {
            planPath = join(plansDir, entry)
            break
          }
        }
      } catch {
        return { complete: false }
      }

      if (!planPath) return { complete: false }

      const progress = getPlanProgress(planPath)
      if (progress.isComplete) {
        return {
          complete: true,
          summary: `Plan completed: ${progress.completed}/${progress.total} tasks done`,
        }
      }
      return { complete: false }
    }

    case "review_verdict": {
      const msg = ctx.lastAssistantMessage ?? ""
      if (/\[\s*APPROVE\s*\]/i.test(msg)) {
        return {
          complete: true,
          verdict: "approve",
          summary: "Review verdict: APPROVE",
        }
      }
      if (/\[\s*REJECT\s*\]/i.test(msg)) {
        return {
          complete: true,
          verdict: "reject",
          summary: "Review verdict: REJECT",
        }
      }
      return { complete: false }
    }

    case "agent_signal": {
      const msg = ctx.lastAssistantMessage ?? ""
      if (msg.includes(WORKFLOW_STEP_COMPLETE_SIGNAL)) {
        return {
          complete: true,
          summary: "Agent signaled step completion",
        }
      }
      // Also check custom keywords
      const keywords = ctx.config.keywords ?? []
      if (keywords.length > 0 && containsKeyword(msg, keywords)) {
        return {
          complete: true,
          summary: `Agent signaled via keyword`,
        }
      }
      return { complete: false }
    }

    default:
      return { complete: false }
  }
}
