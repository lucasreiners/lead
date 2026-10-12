import type { Plugin } from "@opencode/plugin"
import { isAbsolute, relative, resolve } from "node:path"
import { existsSync } from "node:fs"
import type { LeadConfig } from "../../config/schema"
import type { ResolvedContinuationConfig } from "../../config/continuation"
import type { CreatedHooks } from "../../hooks/create-hooks"
import { capturePlanWrite } from "../../hooks/plan-capture"
import { resetTokenState } from "../../hooks/session-token-state"
import { captureToolMetrics, reportAndClearSessionMetrics } from "../../features/delegation-metrics"
import { checkWorkflowContinuation, handleWorkflowCommand } from "../../features/workflow/hook"
import { readWorkState } from "../../features/work-state/storage"
import { loadActiveInstance } from "../../features/workflow/storage"
import { warn } from "../../shared/log"
import { registerV2Commands } from "./v2-commands"

export interface V2HookOptions {
  pluginConfig: LeadConfig
  continuation: ResolvedContinuationConfig
  hooks: CreatedHooks
}

function toolArgs(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
}

/** Paths touched by V2's patch tool, including rename destinations. */
function patchPaths(input: Record<string, unknown>, includeDeleted = true): string[] {
  if (typeof input.patchText !== "string") return []
  return [...input.patchText.matchAll(/^\*\*\* (Add File|Update File|Delete File|Move to): (.+)\r?$/gm)]
    .filter((match) => includeDeleted || match[1] !== "Delete File")
    .map((match) => match[2].trim())
}

export async function registerV2Hooks(ctx: Plugin.Context, options: V2HookOptions): Promise<Plugin.Cleanup> {
  const { hooks, pluginConfig, continuation } = options
  const directory = resolve(ctx.location.directory)
  const pending = new Map<string, string[]>()
  const sessions = new Set<string>()
  const controller = new AbortController()

  const ownsSession = async (sessionID: string) => {
    const session = await ctx.session.get({ sessionID })
    return resolve(session.location.directory) === directory
  }
  const clear = (sessionID: string) => {
    pending.delete(sessionID)
    sessions.delete(sessionID)
    hooks.clearSession(sessionID)
    resetTokenState(sessionID)
    reportAndClearSessionMetrics(sessionID)
  }

  await registerV2Commands(ctx, options)

  await ctx.session.hook("prompt", async (event) => {
    if (!await ownsSession(event.sessionID)) return
    sessions.add(event.sessionID)
    hooks.markSessionCreated(event.sessionID)
    const response = handleWorkflowCommand(event.prompt.text, directory)
    if (response) {
      // Append rather than replace: attachment mention offsets stay valid.
      event.prompt.text += `\n\n${response}`
    }
  })

  await ctx.session.hook("context", async (event) => {
    const prompts = pending.get(event.sessionID)
    if (!prompts) return
    if (!await ownsSession(event.sessionID)) {
      pending.delete(event.sessionID)
      return
    }
    event.system.push(...prompts.map((text) => ({ type: "text" as const, text })))
    pending.delete(event.sessionID)
  })

  await ctx.tool.hook("execute.before", (event) => {
    sessions.add(event.sessionID)
    const args = toolArgs(event.input)
    const paths = event.tool === "patch" ? patchPaths(args) : [args.path ?? args.filePath]
    for (const path of paths) {
      const result = hooks.checkArchitectWrite({
        toolName: event.tool === "patch" ? "write" : event.tool,
        args: { ...args, path },
        agentName: event.agent,
      })
      if (result.verdict === "deny") throw new Error(result.reason)
    }
    captureToolMetrics({
      toolName: event.tool,
      sessionId: event.sessionID,
      args,
    })
  })

  // Native permissions cover all edit tools (including multi-file patches).
  await ctx.permission.hook("evaluate", async (event) => {
    if (pluginConfig.disabled_hooks?.includes("architect-md-only")) return
    if (event.action !== "edit" || !["architect", "product-owner"].includes(event.agent ?? "")) return
    const session = await ctx.session.get({ sessionID: event.sessionID })
    const root = resolve(session.location.directory, ".lead")
    const invalid = event.resources.some((resource) => {
      const path = resolve(session.location.directory, resource)
      const child = relative(root, path)
      return !path.endsWith(".md") || child === ".." || child.startsWith("../") || isAbsolute(child)
    })
    if (invalid) {
      event.effect = "deny"
      event.message = `${event.agent} may only edit Markdown files inside .lead/.`
    }
  })

  await ctx.tool.hook("execute.after", async (event) => {
    if (event.status !== "completed") return
    sessions.add(event.sessionID)
    const session = await ctx.session.get({ sessionID: event.sessionID })
    const args = toolArgs(event.input)
    const writes = event.tool === "patch"
      ? patchPaths(args, false)
          .filter((path) => existsSync(resolve(session.location.directory, path)))
          .map((path) => ({ path }))
      : [args]
    for (const write of writes) {
      capturePlanWrite({
        toolName: event.tool === "patch" ? "write" : event.tool,
        args: { ...write, path: typeof write.path === "string" ? resolve(session.location.directory, write.path) : write.path },
        agentName: event.agent,
        sessionId: event.sessionID,
        directory: session.location.directory,
      })
    }
    hooks.buildVerificationReminder({
      toolName: event.tool,
      directory: session.location.directory,
    })
  })

  await ctx.session.hook("compaction", async (event) => {
    if (!continuation.recovery.compaction) return
    sessions.add(event.sessionID)
    const session = await ctx.session.get({ sessionID: event.sessionID })
    const recovery = hooks.checkCompactionRecovery({ sessionId: event.sessionID, directory: session.location.directory })
    if (recovery.recoveryPrompt) event.system.push({ type: "text", text: recovery.recoveryPrompt })
  })

  const subscription = (async () => {
    try {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        if (controller.signal.aborted) break
        try {
          if (event.type === "session.deleted") {
            if (sessions.has(event.data.sessionID)) clear(event.data.sessionID)
            continue
          }
          // Use the V2 status event, not its deprecated session.idle alias.
          if (event.type !== "session.status" || event.data.status.type !== "idle") continue
          const sessionID = event.data.sessionID
          if (!await ownsSession(sessionID) || controller.signal.aborted) continue
          reportAndClearSessionMetrics(sessionID)
          if (!continuation.idle.enabled) continue
          const prompts: string[] = []
          const state = readWorkState(directory)
          if (continuation.idle.work && state?.session_ids.includes(sessionID)) {
            const result = hooks.checkContinuation({ sessionId: sessionID, directory })
            if (result.continuationPrompt) prompts.push(result.continuationPrompt)
          }
          const workflow = loadActiveInstance(directory)
          if (continuation.idle.workflow && workflow?.session_ids.includes(sessionID)) {
            const result = await checkWorkflowContinuation({ sessionId: sessionID, directory, customDirs: pluginConfig.workflows?.directories })
            if (result.switchAgent) await ctx.session.switchAgent({ sessionID, agent: result.switchAgent })
            if (result.continuationPrompt) prompts.push(result.continuationPrompt)
          }
          if (prompts.length) {
            sessions.add(sessionID)
            pending.set(sessionID, prompts)
          }
        } catch (error) {
          if (!controller.signal.aborted) warn("V2 event handling failed", String(error))
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) warn("V2 event subscription failed", String(error))
    }
  })()

  return async () => {
    controller.abort()
    await subscription
    for (const sessionID of sessions) clear(sessionID)
    pending.clear()
  }
}
