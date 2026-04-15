import { describe, it, expect } from "bun:test"
import { resolveSafePath } from "./resolve-safe-path"

describe("resolveSafePath", () => {
  const base = "/sandbox/project"

  it("allows normal relative paths", () => {
    const result = resolveSafePath(base, "src/file.ts")
    expect(result).toBe("/sandbox/project/src/file.ts")
  })

  it("allows nested relative paths", () => {
    const result = resolveSafePath(base, "a/b/c/d.txt")
    expect(result).toBe("/sandbox/project/a/b/c/d.txt")
  })

  it("rejects absolute paths", () => {
    expect(() => resolveSafePath(base, "/etc/passwd")).toThrow("absolute path not allowed")
  })

  it("rejects path traversal with ..", () => {
    expect(() => resolveSafePath(base, "../outside/file.ts")).toThrow()
  })

  it("rejects embedded .. segments", () => {
    expect(() => resolveSafePath(base, "src/../../../etc/passwd")).toThrow()
  })

  it("allows dot-prefixed names that don't traverse", () => {
    const result = resolveSafePath(base, ".opencode/skills")
    expect(result).toBe("/sandbox/project/.opencode/skills")
  })
})
