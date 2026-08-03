import { describe, it, expect } from "bun:test"
import type { Part } from "@opencode-ai/sdk"
import { replaceParts, textPart } from "./parts"

describe("parts", () => {
  describe("textPart", () => {
    it("produces a text part carrying the given text", () => {
      const part = textPart("hello world")
      expect(part.type).toBe("text")
      expect((part as { text: string }).text).toBe("hello world")
    })
  })

  describe("replaceParts", () => {
    // IMPORTANT: opencode hands the plugin the SAME array reference it later
    // passes to the prompt pipeline (`trigger(..., { parts: Ye })` then
    // `prompt({ parts: Ye })`). If a hook does `output.parts = [...]`, it only
    // rebinds the property on the *wrapper* object passed to the hook — the
    // original array `Ye` is left untouched and the replacement is silently
    // discarded downstream. Therefore these tests assert on the ORIGINAL
    // array reference itself (identity), not just on `output.parts` or a
    // freshly-read value. Do NOT "simplify" these to value-only assertions
    // (e.g. `expect(output.parts[0].text)...`) — that would pass even if
    // `replaceParts` were rewritten to reassign instead of mutate, silently
    // reintroducing the bug.

    it("mutates the original array in place (reference identity)", () => {
      const original: Part[] = []
      const output = { parts: original }

      replaceParts(output, textPart("new content"))

      // Assert on `original`, not on `output.parts`, to prove no reassignment occurred.
      expect(original).toHaveLength(1)
      expect((original[0] as { text: string }).text).toBe("new content")
      // The wrapper's `parts` property must still be the very same array instance.
      expect(output.parts).toBe(original)
    })

    it("clears pre-existing content", () => {
      const stalePart = textPart("stale")
      const original: Part[] = [stalePart]
      const output = { parts: original }

      replaceParts(output, textPart("fresh"))

      expect(original).toHaveLength(1)
      expect(original).not.toContain(stalePart)
      expect((original[0] as { text: string }).text).toBe("fresh")
      expect(output.parts).toBe(original)
    })

    it("supports replacing with multiple parts", () => {
      const original: Part[] = [textPart("stale")]
      const output = { parts: original }

      replaceParts(output, textPart("first"), textPart("second"), textPart("third"))

      expect(original).toHaveLength(3)
      expect(original.map((p) => (p as { text: string }).text)).toEqual(["first", "second", "third"])
      expect(output.parts).toBe(original)
    })
  })
})

describe("textPart — id format", () => {
  // REGRESSION GUARD (v1.6.0): opencode brands part IDs with
  // `String.check(isStartsWith("prt"))` and the command pipeline calls
  // `PartID.make(id)` on any part that already carries an id. An id that does
  // not start with "prt" fails validation and silently aborts the whole
  // command — /implement and /finalize-issue did nothing at all.
  // Do NOT relax this assertion.
  it("produces an id starting with 'prt' so opencode's PartID brand accepts it", () => {
    expect(textPart("hello").id).toMatch(/^prt/)
  })

  it("produces unique ids for parts created in the same millisecond", () => {
    const ids = new Set(Array.from({ length: 50 }, () => textPart("x").id))
    expect(ids.size).toBe(50)
  })
})

describe("replaceParts — attachment preservation", () => {
  // The command pipeline hands us the user's resolved parts, which may include
  // file attachments (e.g. `/implement @plan.md`). We substitute the prompt
  // TEXT only — blowing away the whole array would silently drop their files.
  it("keeps non-text parts and drops only the old text parts", () => {
    const file = { id: "prt_file1", type: "file", filename: "plan.md" } as unknown as Part
    const original = [textPart("stale template"), file]
    const output = { parts: original }

    replaceParts(output, textPart("enriched prompt"))

    expect(output.parts).toBe(original)
    expect(output.parts).toHaveLength(2)
    expect((output.parts[0] as unknown as { text: string }).text).toBe("enriched prompt")
    expect(output.parts[1]).toBe(file)
  })
})
