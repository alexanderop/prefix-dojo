/** Helpers for the shell commands a tool understands. */
import { RED, RESET } from "./ansi"
import {
  containsPane,
  reject,
  type PaneNode,
  type PaneLeaf,
  type PaneVariant,
  type TrainerState,
} from "./state"

function mapLeaves(node: PaneNode, transform: (pane: PaneLeaf) => PaneNode): PaneNode {
  if (node.kind === "leaf") return transform(node)
  return {
    kind: "split",
    dir: node.dir,
    children: [mapLeaves(node.children[0], transform), mapLeaves(node.children[1], transform)],
  }
}

/** Replace what a static pane shows, so CLI-driven agents change the sidebar too. */
export function setPaneLines(
  state: TrainerState,
  id: number,
  lines: string[],
  variant?: PaneVariant,
): void {
  state.root = mapLeaves(state.root, (pane) =>
    pane.id === id ? { ...pane, lines, variant: variant ?? pane.variant } : pane,
  )
}

export function paneIdFromTarget(state: TrainerState, target: string): number | null {
  const match = /^w(\d+):p(\d+)$/.exec(target)
  if (match === null) return null
  const workspaceIndex = Number(match[1]) - 1
  const paneId = Number(match[2]) - 1
  if (workspaceIndex !== state.activeWorkspace) return null
  return containsPane(state.root, paneId) ? paneId : null
}

export function namedAgentPane(state: TrainerState, name: string): number | null {
  const paneId = state.agentPanes[name]
  return paneId !== undefined && containsPane(state.root, paneId) ? paneId : null
}

export function commandError(state: TrainerState, message: string): string[] {
  reject(state, message)
  return [`${RED}error${RESET}  ${message}`]
}
