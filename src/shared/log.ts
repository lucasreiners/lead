import type { createOpencodeClient } from "@opencode-ai/sdk"

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR"
export type SdkClient = ReturnType<typeof createOpencodeClient>

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

let sdkClient: SdkClient | undefined
let currentLevel: LogLevel = (process.env.LEAD_LOG_LEVEL as LogLevel) ?? "INFO"

export function setClient(client: SdkClient): void {
  sdkClient = client
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel]
}

function writeLog(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return
  const extra = args.length > 0 ? ` ${args.map((a) => JSON.stringify(a)).join(" ")}` : ""
  const full = message + extra

  if (sdkClient) {
    try {
      void sdkClient.app.log({
        body: {
          service: "lead",
          level: level.toLowerCase() as "debug" | "info" | "warn" | "error",
          message: full,
        },
      })
    } catch {
      process.stderr.write(`[lead:${level}] ${full}\n`)
    }
  } else {
    process.stderr.write(`[lead:${level}] ${full}\n`)
  }
}

export function debug(message: string, ...args: unknown[]): void {
  writeLog("DEBUG", message, ...args)
}

export function info(message: string, ...args: unknown[]): void {
  writeLog("INFO", message, ...args)
}

export function warn(message: string, ...args: unknown[]): void {
  writeLog("WARN", message, ...args)
}

export function error(message: string, ...args: unknown[]): void {
  writeLog("ERROR", message, ...args)
}
