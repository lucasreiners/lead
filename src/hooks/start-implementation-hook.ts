import { readdir, readFile, stat } from "node:fs/promises"
import { isAbsolute, join, relative, sep } from "node:path"
import { readWorkState, writeWorkState, getPlanProgress } from "../features/work-state/storage"
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
 * 5. Search Markdown files across all .lead/ subdirectories
 */
async function findPlanFile(
  directory: string,
  planNameOrPath: string,
): Promise<string | null> {
  // 1. Absolute path
  if (isAbsolute(planNameOrPath)) {
    try {
      if ((await stat(planNameOrPath)).isFile()) return planNameOrPath
    } catch {
      // ignore
    }
    return null
  }

  // 2. Relative path as-is
  const directPath = join(directory, planNameOrPath)
  try {
    if ((await stat(directPath)).isFile()) return directPath
  } catch {
    // ignore
  }

  // 3. Ticket directory: .lead/<ticket>/plan.md
  const ticketPlanPath = join(directory, STATE_DIR, planNameOrPath, "plan.md")
  try {
    if ((await stat(ticketPlanPath)).isFile()) return ticketPlanPath
  } catch {
    // ignore
  }

  // 4. Ad-hoc directory: .lead/_adhoc/<name>.md
  const adhocName = planNameOrPath.endsWith(".md")
    ? planNameOrPath
    : `${planNameOrPath}.md`
  const adhocPath = join(directory, ADHOC_DIR, adhocName)
  try {
    if ((await stat(adhocPath)).isFile()) return adhocPath
  } catch {
    // ignore
  }

  // 5. Search all .lead/ subdirectories (like **/*.md, excluding dotfiles)
  try {
    const leadDir = join(directory, STATE_DIR)
    const needle = planNameOrPath.toLowerCase()
    const entries = await readdir(leadDir, { recursive: true, withFileTypes: true })
    for (const dirent of entries) {
      if (!dirent.isFile() || !dirent.name.endsWith(".md")) continue
      const entry = relative(leadDir, join(dirent.parentPath, dirent.name)).split(sep).join("/")
      if (entry.split("/").some((part) => part.startsWith("."))) continue
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
    if (existingState) {
      // Explicit /implement enrolls this session and resumes paused work.
      const resumedState = {
        ...existingState,
        paused: false,
        stale_continuation_count: 0,
        session_ids: existingState.session_ids.includes(sessionId)
          ? existingState.session_ids
          : [...existingState.session_ids, sessionId],
      }
      writeWorkState(directory, resumedState)
      const progress = getPlanProgress(existingState.active_plan)
      return {
        prompt: buildContinuationPrompt(resumedState, progress),
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
    planContent = await readFile(planPath, "utf-8")
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
        stale_continuation_count: 0,
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
  const prompt = buildStartPrompt(workState, progress)

  return { prompt }
}

function buildStartPrompt(
  state: WorkState,
  progress: ReturnType<typeof getPlanProgress>,
): string {
  const remaining = progress.total - progress.completed

  return `You are now the **Lead Developer** executing the plan at \`${state.active_plan}\`.

**Plan**: ${state.plan_name}
**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)

## CRITICAL — Your FIRST action

Your FIRST action MUST be to **Read** the plan file. Its \`## Progress\` checkboxes are the sole source of task status.
For an older plan without \`## Progress\`, use its existing task checklist in place; preserve its format.

## Then — Execute tasks

The plan has two sections: \`## Progress\` (checklist to update) and \`## TODOs\` (detailed descriptions to read).

For EACH task, follow this exact sequence:
1. Select the first unchecked \`- [ ]\` task from \`## Progress\`
2. Read the matching \`## TODOs\` entry for What/Files/Acceptance details
3. Execute the task (write code, run commands, create files)
4. Delegate to the **tester** agent for verification
5. Keep the checkbox unchecked until verification returns [PASS], then **Edit** the plan file to mark \`- [ ]\` → \`- [x]\` in \`## Progress\`
6. On [FAIL]: leave the checkbox unchecked, fix, and re-test (max 3 cycles); if still failing, report the blocker
7. Move to next task

Do not stop until all tasks are complete or you are explicitly blocked.`
}

function buildContinuationPrompt(
  state: WorkState,
  progress: ReturnType<typeof getPlanProgress>,
): string {
  const remaining = progress.total - progress.completed
  return `Resuming execution of plan: **${state.plan_name}**

**Progress**: ${progress.completed}/${progress.total} tasks complete (${remaining} remaining)
**Plan file**: \`${state.active_plan}\`

## CRITICAL — Your FIRST action

Your FIRST action MUST be to **Read** the plan file. Its \`## Progress\` checkboxes are the sole source of task status.
For an older plan without \`## Progress\`, use its existing task checklist in place; preserve its format.

## Then — Continue execution

Find the first unchecked \`- [ ]\` task in \`## Progress\` and execute it.
Read the matching \`## TODOs\` entry for detailed What/Files/Acceptance context.

Keep the checkbox unchecked until verification returns [PASS].
For EACH task: implement → tester [PASS] → **Edit** plan (\`- [x]\`) → next task.
On [FAIL], leave the checkbox unchecked, fix, and re-test (max 3 cycles); if still failing, report the blocker.

Do not stop until all tasks are complete or you are explicitly blocked.`
}
