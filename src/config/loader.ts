import { createConfigFsLoader } from "../infrastructure/fs/config-fs-loader"
import { mergeConfigs } from "./merge"
import type { LeadConfig } from "./schema"
import { info } from "../shared/log"

let _loader: ReturnType<typeof createConfigFsLoader> | undefined

function getLoader() {
  if (!_loader) _loader = createConfigFsLoader()
  return _loader
}

/**
 * Load and merge Lead config from:
 * 1. User global config: ~/.config/opencode/lead.jsonc
 * 2. Project config: {directory}/.opencode/lead.jsonc
 *
 * Project config overrides user config.
 * Returns valid LeadConfig even if no files exist (empty defaults).
 */
export function loadLeadConfig(
  directory: string,
  options?: { homeDir?: string },
): LeadConfig {
  const loader = getLoader()
  const userConfig = loader.loadUserConfig(options?.homeDir)
  const projectConfig = loader.loadProjectConfig(directory)
  const merged = mergeConfigs(userConfig, projectConfig)
  info(`Config loaded for directory: ${directory}`)
  return merged
}
