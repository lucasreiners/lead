export interface WorkState {
  active_plan: string
  started_at: string
  session_ids: string[]
  plan_name: string
  agent?: string
  start_sha?: string
  paused?: boolean
  continuation_completed_snapshot?: number
  stale_continuation_count?: number
}

export interface PlanProgress {
  total: number
  completed: number
  isComplete: boolean
}
