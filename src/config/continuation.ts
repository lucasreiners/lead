import type { ContinuationConfig } from "./schema"

export interface ResolvedContinuationConfig {
  recovery: {
    compaction: boolean
  }
  idle: {
    enabled: boolean
    work: boolean
    workflow: boolean
  }
}

const DEFAULTS: ResolvedContinuationConfig = {
  recovery: {
    compaction: true,
  },
  idle: {
    enabled: true,
    work: true,
    workflow: true,
  },
}

export function resolveContinuationConfig(
  raw?: ContinuationConfig,
): ResolvedContinuationConfig {
  if (!raw) return DEFAULTS

  return {
    recovery: {
      compaction: raw.recovery?.compaction ?? DEFAULTS.recovery.compaction,
    },
    idle: {
      enabled: raw.idle?.enabled ?? DEFAULTS.idle.enabled,
      work: raw.idle?.work ?? DEFAULTS.idle.work,
      workflow: raw.idle?.workflow ?? DEFAULTS.idle.workflow,
    },
  }
}
