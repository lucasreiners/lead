import { describe, it, expect, beforeEach } from "bun:test"
import { createHooks } from "./create-hooks"
import type { LeadConfig } from "../config/schema"
import { resolveContinuationConfig } from "../config/continuation"

const baseConfig: LeadConfig = {
  log_level: "INFO",
}

const continuation = resolveContinuationConfig()

describe("createHooks", () => {
  it("returns an object with all hook functions", () => {
    const hooks = createHooks({
      pluginConfig: baseConfig,
      continuation,
      directory: "/tmp",
    })
    expect(typeof hooks.checkContextWindow).toBe("function")
    expect(typeof hooks.createWriteGuard).toBe("function")
    expect(typeof hooks.processMessageForKeywords).toBe("function")
    expect(typeof hooks.checkArchitectWrite).toBe("function")
    expect(typeof hooks.handleStartImplementation).toBe("function")
    expect(typeof hooks.checkContinuation).toBe("function")
    expect(typeof hooks.checkCompactionRecovery).toBe("function")
    expect(typeof hooks.buildVerificationReminder).toBe("function")
    expect(typeof hooks.applyTodoDescriptionOverride).toBe("function")
    expect(typeof hooks.checkStaleTodos).toBe("function")
    expect(typeof hooks.buildTodoPreservationPrompt).toBe("function")
    expect(typeof hooks.captureToDoWrite).toBe("function")
    expect(typeof hooks.updateTokenState).toBe("function")
  })

  it("disables hooks from disabled_hooks config", () => {
    const hooks = createHooks({
      pluginConfig: { ...baseConfig, disabled_hooks: ["context-window-monitor"] },
      continuation,
      directory: "/tmp",
    })
    // Disabled hook should return ok/no-op
    const result = hooks.checkContextWindow({ inputTokens: 0, outputTokens: 0, contextWindow: 1000 })
    expect(result.severity).toBe("ok")
  })

  it("disables write guard when specified", () => {
    const hooks = createHooks({
      pluginConfig: { ...baseConfig, disabled_hooks: ["write-guard"] },
      continuation,
      directory: "/tmp",
    })
    const guard = hooks.createWriteGuard()
    expect(guard).toBeDefined()
  })
})
