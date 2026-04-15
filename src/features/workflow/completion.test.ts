import { describe, it, expect } from "bun:test"
import { checkStepCompletion } from "./completion"
import type { CompletionContext } from "./types"

const baseCtx: Omit<CompletionContext, "config"> = {
  directory: "/tmp/test",
  artifacts: {},
  lastUserMessage: "",
  lastAssistantMessage: "",
}

describe("checkStepCompletion - user_confirm", () => {
  it("detects default keywords", () => {
    const result = checkStepCompletion("user_confirm", {
      ...baseCtx,
      lastUserMessage: "looks good, continue",
      config: { method: "user_confirm" },
    })
    expect(result.complete).toBe(true)
  })

  it("detects custom keywords", () => {
    const result = checkStepCompletion("user_confirm", {
      ...baseCtx,
      lastUserMessage: "proceed",
      config: { method: "user_confirm", keywords: ["proceed"] },
    })
    expect(result.complete).toBe(true)
  })

  it("returns false when no keyword present", () => {
    const result = checkStepCompletion("user_confirm", {
      ...baseCtx,
      lastUserMessage: "not ready yet",
      config: { method: "user_confirm" },
    })
    expect(result.complete).toBe(false)
  })
})

describe("checkStepCompletion - review_verdict", () => {
  it("detects [APPROVE]", () => {
    const result = checkStepCompletion("review_verdict", {
      ...baseCtx,
      lastAssistantMessage: "After review: [APPROVE] — all looks good",
      config: { method: "review_verdict" },
    })
    expect(result.complete).toBe(true)
    expect(result.verdict).toBe("approve")
  })

  it("detects [REJECT]", () => {
    const result = checkStepCompletion("review_verdict", {
      ...baseCtx,
      lastAssistantMessage: "Issues found: [REJECT]",
      config: { method: "review_verdict" },
    })
    expect(result.complete).toBe(true)
    expect(result.verdict).toBe("reject")
  })

  it("returns false when no verdict", () => {
    const result = checkStepCompletion("review_verdict", {
      ...baseCtx,
      lastAssistantMessage: "Still reviewing...",
      config: { method: "review_verdict" },
    })
    expect(result.complete).toBe(false)
  })
})

describe("checkStepCompletion - agent_signal", () => {
  it("detects step-complete signal", () => {
    const result = checkStepCompletion("agent_signal", {
      ...baseCtx,
      lastAssistantMessage: "Done! <!-- workflow:step-complete -->",
      config: { method: "agent_signal" },
    })
    expect(result.complete).toBe(true)
  })

  it("returns false without signal", () => {
    const result = checkStepCompletion("agent_signal", {
      ...baseCtx,
      lastAssistantMessage: "Still working...",
      config: { method: "agent_signal" },
    })
    expect(result.complete).toBe(false)
  })
})
