export interface PlanValidationResult {
  valid: boolean
  issues: PlanValidationIssue[]
}

export interface PlanValidationIssue {
  severity: "error" | "warning"
  message: string
}
