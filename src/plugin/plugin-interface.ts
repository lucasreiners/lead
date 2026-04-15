import type { Hooks } from "@opencode-ai/plugin"
import { createPluginAdapter } from "../runtime/opencode/plugin-adapter"
import type { PluginAdapterArgs } from "../runtime/opencode/plugin-adapter"

/**
 * Create the final Hooks object satisfying the OpenCode Plugin contract.
 * This is the return value of the main plugin entry point.
 */
export function createPluginInterface(args: PluginAdapterArgs): Hooks {
  return createPluginAdapter(args)
}
