import type { Part } from "@opencode-ai/sdk"

/**
 * Create a synthetic Part from text content (for command outputs).
 * The Part type from SDK requires full hydrated fields; we cast for hook output.
 */
export function textPart(text: string): Part {
  return {
    id: `synthetic-${Date.now()}`,
    sessionID: "",
    messageID: "",
    type: "text",
    text,
  } as unknown as Part
}

/**
 * Replace a hook's `parts` payload IN PLACE.
 *
 * opencode passes the SAME array reference it gave the hook on to the prompt
 * pipeline (`trigger("command.execute.before", ..., { parts: Ye })` followed by
 * `prompt({ ..., parts: Ye })`). Reassigning `output.parts = [...]` only rebinds
 * the property on the wrapper object, so the replacement is silently discarded
 * and the raw command template reaches the agent instead.
 *
 * Always mutate — never reassign.
 */
export function replaceParts(output: { parts: Part[] }, ...parts: Part[]): void {
  output.parts.splice(0, output.parts.length, ...parts)
}
