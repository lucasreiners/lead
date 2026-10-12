import { describe, it, expect } from "bun:test"
import type { Plugin } from "@opencode/plugin"
import plugin, { LeadPlugin } from "./index"

describe("Lead Plugin entry point", () => {
  it("exports only the V2 plugin contract", () => {
    const definition: Plugin.Plugin = plugin
    expect(definition.id).toBe("lead")
    expect(typeof definition.setup).toBe("function")
    expect(plugin).toBe(LeadPlugin)
    expect(plugin).not.toHaveProperty("server")
  })
})
