import { BLUE, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "../engine/ansi"
import { initialState, leaf, type PaneNode, type TrainerState } from "../engine/multiplexer"

/** Short colour names keep lesson pane text readable. */
export { BLUE as B, GREEN as G, YELLOW as Y, RED as R, CYAN as C, DIM, RESET as X }

export const shellPane = (id: number, extra: string[] = []): PaneNode => leaf(id, extra, "shell")

export function splitRow(first: PaneNode, second: PaneNode): PaneNode {
  return { kind: "split", dir: "row", children: [first, second] }
}

export function splitColumn(first: PaneNode, second: PaneNode): PaneNode {
  return { kind: "split", dir: "column", children: [first, second] }
}

export function hasSplit(state: TrainerState, direction: "row" | "column"): boolean {
  const walk = (node: PaneNode): boolean =>
    node.kind === "split" &&
    (node.dir === direction || walk(node.children[0]) || walk(node.children[1]))
  return walk(state.root)
}

export const oneShell = (line: string): TrainerState =>
  initialState({ root: shellPane(0, [line]), activePaneId: 0 })
