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
    // No plan specified — check for active plan
    const existingState = readWorkState(directory)
    if (existingState && !existingState.paused) {
      const progress = getPlanProgress(existingState.active_plan)
      return {
        prompt: buildContinuationPrompt(existingState, progress),
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

  // Create or update work state
  const workState: WorkState = {
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
  _planContent: string,
): string {
  const remaining = progress.total - progress.completed
  return `You are now the **Executor** — your job is to execute the plan at \`${state.active_plan}\`.

**Plan**: ${state.plan_name}
**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)

Start by reading the plan file to understand the current state. Find the first unchecked \`- [ ]\` task and begin executing it. Work through tasks sequentially, marking each \`- [x]\` when complete.

**Execution protocol**:
1. Read the plan file to find the first unchecked task
2. Mark it in_progress in the sidebar todos
3. Execute the task step by step
4. Verify acceptance criteria are met
5. Mark \`- [ ]\` → \`- [x]\` in the plan file
6. Continue to the next task

Do not stop until all tasks are complete or you are explicitly blocked.`
}

function buildContinuationPrompt(
  state: WorkState,
  progress: ReturnType<typeof getPlanProgress>,
): string {
  const remaining = progress.total - progress.completed
  return `Resuming work on plan: **${state.plan_name}**

**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)
**Plan file**: \`${state.active_plan}\`

Read the plan file, find the next unchecked \`- [ ]\` task, and continue execution.`
}
