import { join } from "path"
import { readWorkState, writeWorkState } from "../features/work-state/storage"
import { getPlanProgress } from "../features/work-state/storage"
import { ADHOC_DIR, STATE_DIR } from "../features/work-state/constants"
import type { WorkState } from "../features/work-state/types"

/**
 * Start-implementation hook.
 * Handles the `/implement` command.
 * Finds the plan file, creates work state, and returns a prompt directing executor to begin.
 */

export interface StartImplementationOptions {
  /** The command arguments (plan name or path) */
  args: string
  /** Current session ID */
  sessionId: string
  /** Working directory */
  directory: string
  /** Optional git SHA at start */
  startSha?: string
}

export interface StartImplementationResult {
  /** Prompt to inject into the session */
  prompt: string | null
  /** Error message if the command failed */
  error?: string
}

/**
 * Find a plan file by name, ticket reference, or path.
 *
 * Search order:
 * 1. Absolute path
 * 2. Relative path as-is
 * 3. Ticket directory: .lead/<input>/plan.md
 * 4. Ad-hoc directory: .lead/_adhoc/<input>.md
 * 5. Glob across all .lead/ subdirectories
 */
async function findPlanFile(
  directory: string,
  planNameOrPath: string,
): Promise<string | null> {
  // 1. Absolute path
  if (planNameOrPath.startsWith("/")) {
    try {
      if (await Bun.file(planNameOrPath).exists()) return planNameOrPath
    } catch {
      // ignore
    }
    return null
  }

  // 2. Relative path as-is
  const directPath = join(directory, planNameOrPath)
  try {
    if (await Bun.file(directPath).exists()) return directPath
  } catch {
    // ignore
  }

  // 3. Ticket directory: .lead/<ticket>/plan.md
  const ticketPlanPath = join(directory, STATE_DIR, planNameOrPath, "plan.md")
  try {
    if (await Bun.file(ticketPlanPath).exists()) return ticketPlanPath
  } catch {
    // ignore
  }

  // 4. Ad-hoc directory: .lead/_adhoc/<name>.md
  const adhocName = planNameOrPath.endsWith(".md")
    ? planNameOrPath
    : `${planNameOrPath}.md`
  const adhocPath = join(directory, ADHOC_DIR, adhocName)
  try {
    if (await Bun.file(adhocPath).exists()) return adhocPath
  } catch {
    // ignore
  }

  // 5. Glob across all .lead/ subdirectories
  try {
    const glob = new Bun.Glob("**/*.md")
    const leadDir = join(directory, STATE_DIR)
    const needle = planNameOrPath.toLowerCase()
    for await (const entry of glob.scan(leadDir)) {
      // Skip state files
      if (entry === "state.json") continue
      const basename = entry.replace(/\.md$/, "").toLowerCase()
      const parts = basename.split("/")
      const leaf = parts[parts.length - 1]
      // Match on directory name (ticket) or file name
      if (
        leaf === needle ||
        leaf.includes(needle) ||
        parts.some((p) => p === needle || p.includes(needle))
      ) {
        return join(leadDir, entry)
      }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Handle the /implement command.
 * Finds the plan file and creates work state with reference to it.
 */
export async function handleStartImplementation(options: StartImplementationOptions): Promise<StartImplementationResult> {
  const { args, sessionId, directory, startSha } = options

  const trimmedArgs = args.trim()

  if (!trimmedArgs) {
    // No plan specified — check for active or paused plan
    const existingState = readWorkState(directory)
    if (existingState && !existingState.paused) {
      const progress = getPlanProgress(existingState.active_plan)
      return {
        prompt: buildContinuationPrompt(existingState, progress),
      }
    }
    if (existingState && existingState.paused) {
      // Resume the paused plan
      const resumedState = { ...existingState, paused: false }
      writeWorkState(directory, resumedState)
      const progress = getPlanProgress(existingState.active_plan)
      return {
        prompt: buildStartPrompt(resumedState, progress, ""),
      }
    }
    return {
      prompt: null,
      error:
        "No plan specified. Usage: /implement <plan-name-or-ticket>\n\nPlans are in .lead/<ticket>/plan.md or .lead/_adhoc/",
    }
  }

  // Find the plan file
  const planPath = await findPlanFile(directory, trimmedArgs)
  if (!planPath) {
    return {
      prompt: null,
      error: `Plan not found: "${trimmedArgs}"\n\nLooked in:\n- .lead/${trimmedArgs}/plan.md\n- .lead/_adhoc/${trimmedArgs}.md\n\nCreate a plan first with the architect agent.`,
    }
  }

  // Read the plan to get its name
  let planContent = ""
  try {
    planContent = await Bun.file(planPath).text()
  } catch {
    return { prompt: null, error: `Could not read plan file: ${planPath}` }
  }

  const titleMatch = planContent.match(/^#\s+(.+)$/m)
  const planName = titleMatch?.[1]?.trim() ?? trimmedArgs

  // Reuse existing state if already captured during plan creation (paused=true for this plan)
  const existingState = readWorkState(directory)
  const reuseExisting = existingState?.paused && existingState.active_plan === planPath

  const workState: WorkState = reuseExisting
    ? {
        ...existingState!,
        paused: false,
        start_sha: startSha ?? existingState!.start_sha,
        session_ids: existingState!.session_ids.includes(sessionId)
          ? existingState!.session_ids
          : [...existingState!.session_ids, sessionId],
      }
    : {
        active_plan: planPath,
        started_at: new Date().toISOString(),
        session_ids: [sessionId],
        plan_name: planName,
        start_sha: startSha,
        paused: false,
        continuation_completed_snapshot: 0,
        stale_continuation_count: 0,
      }

  writeWorkState(directory, workState)

  const progress = getPlanProgress(planPath)
  const prompt = buildStartPrompt(workState, progress, planContent)

  return { prompt }
}

function buildStartPrompt(
  state: WorkState,
  progress: ReturnType<typeof getPlanProgress>,
  planContent: string,
): string {
  const remaining = progress.total - progress.completed
  const todoSeedBlock = buildTodoSeedBlock(planContent)

  return `You are now the **Lead Developer** executing the plan at \`${state.active_plan}\`.

**Plan**: ${state.plan_name}
**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)

## Step 1 — Seed your sidebar todos

Before writing any code, use the **TodoWrite tool** to load ALL remaining plan tasks as todos.
Each \`- [ ]\` task in the plan must become one todo item with status \`pending\`.
Each \`- [x]\` task must become one todo item with status \`completed\`.
${todoSeedBlock}
This is non-negotiable. The todo list IS your execution tracker. Without it, continuation is blind.

## Step 2 — Execute

Work through tasks top-to-bottom:
1. Set the current task todo to \`in_progress\`
2. Execute the task (write code, run commands, create files)
3. Delegate to the **tester** agent for verification
4. On [PASS]: mark \`- [ ]\` → \`- [x]\` in the plan file AND set todo to \`completed\`
5. On [FAIL]: fix, re-test, repeat (max 3 cycles)
6. Move to next task

Do not stop until all tasks are complete or you are explicitly blocked.`
}

function buildTodoSeedBlock(planContent: string): string {
  if (!planContent) return ""

  const lines = planContent.split("\n")
  const todos: Array<{ label: string; done: boolean }> = []

  for (const line of lines) {
    const unchecked = line.match(/^\s*-\s+\[ \]\s+(.+)$/)
    if (unchecked?.[1]) {
      todos.push({ label: unchecked[1].trim(), done: false })
      continue
    }
    const checked = line.match(/^\s*-\s+\[x\]\s+(.+)$/i)
    if (checked?.[1]) {
      todos.push({ label: checked[1].trim(), done: true })
    }
  }

  if (todos.length === 0) return ""

  const lines2 = ["", "The todos to seed (in order):"]
  for (const t of todos) {
    lines2.push(`- ${t.done ? "[completed]" : "[pending]"} ${t.label}`)
  }
  lines2.push("")
  return lines2.join("\n")
}

function buildContinuationPrompt(
  state: WorkState,
  progress: ReturnType<typeof getPlanProgress>,
): string {
  const remaining = progress.total - progress.completed
  return `Resuming execution of plan: **${state.plan_name}**

**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)
**Plan file**: \`${state.active_plan}\`

## Step 1 — Re-sync your sidebar todos

Read the plan file at \`${state.active_plan}\` and use **TodoWrite** to rebuild the full todo list:
- Every \`- [ ]\` task → \`pending\`
- Every \`- [x]\` task → \`completed\`

This re-sync is mandatory before continuing — it is the only reliable source of truth after a session break.

## Step 2 — Continue execution

Find the first \`pending\` todo (first unchecked \`- [ ]\` in the plan), set it to \`in_progress\`, and execute it.
Follow the same loop: implement → tester [PASS] → mark \`- [x]\` in plan + \`completed\` in todos → next task.

Do not stop until all tasks are complete or you are explicitly blocked.`
}
