import { BLUE, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "../engine/ansi"
import type { DrillDefinition } from "../drills/definition"
import { initialState, leaf, type PaneNode, type TrainerState } from "../engine/multiplexer"
import type { Lesson, Track } from "./types"

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

/** A plain shell before the tool is attached: no status line, no panes. */
export const outsideShell = (line: string): TrainerState =>
  initialState({ root: shellPane(0, [line]), activePaneId: 0, detached: true })

/**
 * A course entry that is a timed drill: sixty seconds of shuffled prompts
 * written into the pane. It clears once the best score reaches the target.
 */
export function drillLesson({
  slug,
  track,
  module,
  drill,
}: {
  slug: string
  track: Track
  module: string
  drill: DrillDefinition
}): Lesson {
  return {
    slug,
    track,
    module,
    title: drill.title,
    body: "Prompts appear in the focused pane with their par, the key count a clean answer needs. Stay within par and the round scores.",
    task: `Press [enter] to start. Do what the pane says, as many times as you can in 60 seconds. Reach ${drill.target} clean rounds to clear it.`,
    takeaway:
      "A round only scores when you stay within par, so a fumbled key costs the point. Repeat the drill until the keys come without thinking.",
    keymap: track,
    input: "drill",
    drill,
    setup: () => oneShell(`${DIM}# press enter to start · the prompt will appear here${RESET}`),
    goal: () => false,
  }
}
