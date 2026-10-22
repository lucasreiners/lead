import { Plugin } from "@opencode/plugin"
import { setupV2 } from "./runtime/opencode/v2-setup"

declare const __LEAD_VERSION__: string | undefined

const LEAD_VERSION = typeof __LEAD_VERSION__ !== "undefined" ? __LEAD_VERSION__ : "dev"

/** L.E.A.D.'s OpenCode V2 plugin definition. */
export const LeadPlugin = Plugin.define({
  id: "lead",
  setup: (ctx) => setupV2(ctx, LEAD_VERSION),
})

export default LeadPlugin
export type { LeadConfig } from "./config/schema"
export type { LeadAgentName } from "./agents/types"
