import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import type { WorkflowInstance, ActiveInstancePointer } from "./types"
import { WORKFLOW_STATE_DIR, ACTIVE_INSTANCE_FILE } from "./constants"

function ensureWorkflowDir(dir: string): void {
  const stateDir = join(dir, WORKFLOW_STATE_DIR)
  mkdirSync(stateDir, { recursive: true })
}

export function saveWorkflowInstance(dir: string, instance: WorkflowInstance): void {
  ensureWorkflowDir(dir)
  const filePath = join(dir, WORKFLOW_STATE_DIR, `${instance.instance_id}.json`)
  writeFileSync(filePath, JSON.stringify(instance, null, 2))
}

export function loadWorkflowInstance(dir: string, instanceId: string): WorkflowInstance | null {
  const filePath = join(dir, WORKFLOW_STATE_DIR, `${instanceId}.json`)
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as WorkflowInstance
  } catch {
    return null
  }
}

export function loadActiveInstance(dir: string): WorkflowInstance | null {
  const pointerPath = join(dir, ACTIVE_INSTANCE_FILE)
  if (!existsSync(pointerPath)) return null
  try {
    const pointer = JSON.parse(readFileSync(pointerPath, "utf-8")) as ActiveInstancePointer
    return loadWorkflowInstance(dir, pointer.instance_id)
  } catch {
    return null
  }
}

export function setActiveInstance(dir: string, instanceId: string): void {
  ensureWorkflowDir(dir)
  const pointerPath = join(dir, ACTIVE_INSTANCE_FILE)
  const pointer: ActiveInstancePointer = { instance_id: instanceId }
  writeFileSync(pointerPath, JSON.stringify(pointer, null, 2))
}

export function clearActiveInstance(dir: string): void {
  const pointerPath = join(dir, ACTIVE_INSTANCE_FILE)
  if (existsSync(pointerPath)) {
    try {
      const { unlinkSync } = require("fs") as typeof import("fs")
      unlinkSync(pointerPath)
    } catch {
      // ignore
    }
  }
}

export function listInstanceIds(dir: string): string[] {
  const stateDir = join(dir, WORKFLOW_STATE_DIR)
  if (!existsSync(stateDir)) return []
  try {
    const { readdirSync } = require("fs") as typeof import("fs")
    return readdirSync(stateDir)
      .filter((f: string) => f.endsWith(".json") && f !== "active-instance.json")
      .map((f: string) => f.replace(".json", ""))
  } catch {
    return []
  }
}
