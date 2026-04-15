import { parse as parseJsonc } from "jsonc-parser"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { LeadConfigSchema } from "../../config/schema"
import type { LeadConfig } from "../../config/schema"
import { warn } from "../../shared/log"

const CONFIG_FILENAME = "lead.jsonc"

export interface ConfigFsLoader {
  loadUserConfig(homeDir?: string): LeadConfig
  loadProjectConfig(projectDir: string): LeadConfig
}

function readJsoncFile(filePath: string): LeadConfig {
  if (!existsSync(filePath)) return {}

  try {
    const content = readFileSync(filePath, "utf-8")
    const errors: Array<{ error: number; offset: number; length: number }> = []
    const parsed = parseJsonc(content, errors) as unknown

    if (errors.length > 0) {
      warn(`Config file has parse errors: ${filePath}`, errors)
    }

    if (parsed === null || parsed === undefined || typeof parsed !== "object") {
      warn(`Config file is not a valid object: ${filePath}`)
      return {}
    }

    const result = LeadConfigSchema.safeParse(parsed)
    if (!result.success) {
      warn(`Config file validation warnings in ${filePath}:`, result.error.issues)
      // Return what we can parse — don't fail hard on validation
      return (parsed as LeadConfig) ?? {}
    }

    return result.data
  } catch (err) {
    warn(`Failed to read config file: ${filePath}`, err)
    return {}
  }
}

export function createConfigFsLoader(): ConfigFsLoader {
  return {
    loadUserConfig(homeDir?: string): LeadConfig {
      const home = homeDir ?? homedir()
      const configPath = join(home, ".config", "opencode", CONFIG_FILENAME)
      return readJsoncFile(configPath)
    },

    loadProjectConfig(projectDir: string): LeadConfig {
      const configPath = join(projectDir, ".opencode", CONFIG_FILENAME)
      return readJsoncFile(configPath)
    },
  }
}
