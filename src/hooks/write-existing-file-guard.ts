/**
 * Write-existing-file guard.
 * Prevents accidental overwrite of existing files by tracking which files
 * have been read in a session before a write is attempted.
 */

export interface WriteGuardState {
  /** Files that have been read in this session (absolute paths) */
  readFiles: Set<string>
  /** Files that have been written in this session (absolute paths) */
  writtenFiles: Set<string>
}

export interface WriteGuardCheckResult {
  /** Whether the write should be allowed */
  allowed: boolean
  /** Reason for denial if not allowed */
  reason?: string
}

/** Tool names that write to files */
const WRITE_TOOLS = new Set(["write", "Write", "edit", "Edit"])

/** Tool names that read files */
const READ_TOOLS = new Set(["read", "Read", "cat"])

/**
 * Create a write guard instance for a session.
 * Returns helper functions to track reads/writes and check for unsafe overwrites.
 */
export function createWriteGuard() {
  const state: WriteGuardState = {
    readFiles: new Set(),
    writtenFiles: new Set(),
  }

  /** Record that a file has been read */
  function markRead(filePath: string): void {
    state.readFiles.add(filePath)
  }

  /** Record that a file has been written */
  function markWritten(filePath: string): void {
    state.writtenFiles.add(filePath)
  }

  /**
   * Check if a write to the given path is safe.
   * Unsafe = file exists on disk AND was not read in this session (and wasn't written by us).
   */
  async function checkWrite(filePath: string): Promise<WriteGuardCheckResult> {
    // If we already wrote this file, allow subsequent writes
    if (state.writtenFiles.has(filePath)) {
      return { allowed: true }
    }

    // If we read this file in this session, we know its current state — allow
    if (state.readFiles.has(filePath)) {
      return { allowed: true }
    }

    // Check if the file exists on disk
    try {
      const exists = await Bun.file(filePath).exists()
      if (exists) {
        return {
          allowed: false,
          reason: `File ${filePath} already exists. Read it first with the Read tool before overwriting.`,
        }
      }
    } catch {
      // If we can't check, allow the write (don't block on errors)
    }

    return { allowed: true }
  }

  /** Check if a tool call event should update read/write tracking */
  function processToolCall(toolName: string, args: Record<string, unknown>): void {
    const path = (args["path"] as string) || (args["filePath"] as string)
    if (!path) return

    if (READ_TOOLS.has(toolName)) {
      markRead(path)
    } else if (WRITE_TOOLS.has(toolName)) {
      markWritten(path)
    }
  }

  return {
    markRead,
    markWritten,
    checkWrite,
    processToolCall,
    getState: () => ({ ...state }),
  }
}

export type WriteGuard = ReturnType<typeof createWriteGuard>
