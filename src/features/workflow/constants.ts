export const WORKFLOW_STATE_DIR = ".lead/workflows"
export const ACTIVE_INSTANCE_FILE = ".lead/workflows/active-instance.json"
export const WORKFLOW_DIRS = {
  project: ".opencode/workflows",
  user: ".config/opencode/workflows", // relative to homedir
}
export const WORKFLOW_CONTINUATION_MARKER = "<!-- lead:workflow-continuation -->"
export const WORKFLOW_STEP_COMPLETE_SIGNAL = "<!-- workflow:step-complete -->"
