/**
 * Pure state machine for the practice terminal. `applyKey` routes one key
 * press by mode; `executeShellCommand` runs one line typed into a pane.
 * Both clone the state, so the caller keeps the previous one.
 */
import { findBinding, type Tool, type ToolId } from "./bindings"
import { runCopyMode, runRenameMode, runResizeMode, runWorkspacePicker } from "./modes"
import { keyLabel, reject, type KeyInput, type TrainerState } from "./state"
import { toolFor } from "../tools"

export type * from "./state"
export {
  activeLeaf,
  agentSummaries,
  containsPane,
  did,
  initialState,
  keyLabel,
  leaf,
  leaves,
  paneRects,
  paneTarget,
} from "./state"
export type { Tool, ToolId }

/** Kept as the lesson-facing name for a tool id. */
export type Keymap = ToolId

export interface ShellCommandResult {
  state: TrainerState
  output: string[] | null
}

function resolve(tool: Tool | ToolId): Tool {
  return typeof tool === "string" ? toolFor(tool) : tool
}

export function applyKey(
  state: TrainerState,
  input: KeyInput,
  toolOrId: Tool | ToolId,
): TrainerState {
  const tool = resolve(toolOrId)
  const next = structuredClone(state)
  next.keystrokes += 1
  next.rejected = false
  const label = keyLabel(input)

  switch (next.mode.kind) {
    case "copy":
      runCopyMode(next, input, tool)
      return next
    case "resize":
      runResizeMode(next, input)
      return next
    case "rename":
      runRenameMode(next, input)
      return next
    case "workspace-picker":
      runWorkspacePicker(next, input)
      return next
    case "help":
    case "goto":
      if (input.key === "Escape" || input.key === "q") {
        next.mode = { kind: "terminal" }
        next.lastAction = "closed overlay"
      }
      return next
    case "terminal":
      if (label === tool.prefix) {
        next.mode = { kind: "prefix" }
        next.lastAction = "prefix armed"
      } else {
        next.lastAction = "sent key to the focused terminal"
      }
      return next
    case "prefix": {
      next.mode = { kind: "terminal" }
      const binding = findBinding(tool, label)
      if (binding === undefined) {
        reject(next, `${tool.label} has no binding for prefix + ${input.key}`)
      } else {
        binding.run(next, label)
      }
      return next
    }
  }
}

export function executeShellCommand(
  state: TrainerState,
  command: string,
  toolOrId: Tool | ToolId,
): ShellCommandResult {
  const tool = resolve(toolOrId)
  const next = structuredClone(state)
  next.rejected = false
  const normalized = command.trim().replace(/\s+/g, " ")

  for (const rule of tool.shellCommands) {
    const match = rule.pattern.exec(normalized)
    if (match === null) continue
    return { state: next, output: rule.run(next, match) }
  }

  return { state: next, output: null }
}

export function applyShellCommand(
  state: TrainerState,
  command: string,
  toolOrId: Tool | ToolId,
): TrainerState {
  return executeShellCommand(state, command, toolOrId).state
}
