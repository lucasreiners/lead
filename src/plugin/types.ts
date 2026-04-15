import type { Hooks, PluginInput } from "@opencode-ai/plugin"

/**
 * Plugin context passed through the initialization chain.
 */
export type PluginContext = PluginInput

/**
 * The full Hooks type from @opencode-ai/plugin.
 * Re-exported for convenience.
 */
export type { Hooks } from "@opencode-ai/plugin"

/**
 * The subset of Hooks that L.E.A.D. implements.
 */
export type LeadHooks = Required<
  Pick<
    Hooks,
    | "tool"
    | "config"
    | "chat.message"
    | "chat.params"
    | "event"
    | "tool.execute.before"
    | "tool.execute.after"
    | "command.execute.before"
    | "tool.definition"
    | "experimental.session.compacting"
  >
>

/**
 * Tools record (empty in v0.1 — OpenCode provides the tools).
 */
export type ToolsRecord = Record<string, never>
