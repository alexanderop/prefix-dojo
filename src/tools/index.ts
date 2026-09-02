/**
 * Every tool the trainer can teach. Adding one means adding a file here that
 * exports a `Tool` and listing it in `tools`; the engine, help overlay, HUD,
 * and structure map read everything else from the descriptor.
 */
import type { Tool, ToolId } from "../engine/bindings"
import { herdr } from "./herdr"
import { tmux } from "./tmux"

export const tools: Record<ToolId, Tool> = { tmux, herdr }

export function toolFor(id: ToolId): Tool {
  return tools[id]
}

export type { Tool, ToolId }
