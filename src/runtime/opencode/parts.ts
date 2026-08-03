import type { Part } from "@opencode-ai/sdk"

let partCounter = 0

/**
 * Create a synthetic Part from text content (for command outputs).
 *
 * The `id` MUST start with `"prt"`. opencode brands part IDs with
 * `String.check(isStartsWith("prt"))`, and the command pipeline runs every part
 * through `id ? PartID.make(id) : PartID.ascending()`. A non-conforming id makes
 * `make()` fail validation, which aborts the whole command — the user sees the
 * command silently do nothing.
 *
 * `sessionID`/`messageID` are placeholders: the command path overwrites them in
 * `resolveUserPart` before the id is validated.
 */
export function textPart(text: string): Part {
  partCounter += 1
  return {
    id: `prt_${Date.now().toString(36)}${partCounter.toString(36).padStart(4, "0")}`,
    sessionID: "",
    messageID: "",
    type: "text",
    text,
  } as unknown as Part
}

/**
 * Replace the TEXT content of a hook's `parts` payload IN PLACE, preserving any
 * non-text parts (file attachments the user passed to the command).
 *
 * Two things matter here:
 *
 * 1. **Mutate, never reassign.** opencode passes the SAME array reference it
 *    gave the hook on to the prompt pipeline
 *    (`trigger("command.execute.before", ..., { parts: Ye })` then
 *    `prompt({ ..., parts: Ye })`). Assigning `output.parts = [...]` only
 *    rebinds the property on the wrapper object, so the replacement is silently
 *    discarded and the raw command template reaches the agent instead.
 *
 * 2. **Keep attachments.** Dropping every existing part would discard files the
 *    user attached (e.g. `/implement @plan.md`).
 */
export function replaceParts(output: { parts: Part[] }, ...parts: Part[]): void {
  const preserved = output.parts.filter((p) => (p as unknown as { type?: string }).type !== "text")
  output.parts.splice(0, output.parts.length, ...parts, ...preserved)
}
