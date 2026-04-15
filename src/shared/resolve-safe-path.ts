import { resolve, relative, isAbsolute } from "path"

/**
 * Resolves a relative path against a base directory, rejecting:
 * - Absolute paths
 * - Path traversal attempts (..)
 * - Paths that would escape the base directory
 */
export function resolveSafePath(base: string, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new Error(`Path traversal rejected: absolute path not allowed: ${relativePath}`)
  }

  if (relativePath.includes("..")) {
    throw new Error(`Path traversal rejected: ".." not allowed in path: ${relativePath}`)
  }

  const resolved = resolve(base, relativePath)
  const rel = relative(base, resolved)

  // If relative path starts with ".." the resolved path is outside base
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path traversal rejected: path escapes sandbox: ${relativePath}`)
  }

  return resolved
}
