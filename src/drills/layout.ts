import { DIM, RESET, YELLOW } from "../engine/ansi"
import {
  did,
  initialState,
  leaf,
  leaves,
  type InitialStateInput,
  type PaneNode,
  type TrainerState,
} from "../engine/state"
import type { DrillPrompt } from "./promptDrill"

export const STAR_LINE = `${YELLOW}★ this one${RESET}`
export const QUIET_LINE = `${DIM}# other pane${RESET}`

export const pane = (id: number, lines: string[] = []): PaneNode => leaf(id, lines, "shell")
export const star = (id: number): PaneNode => pane(id, [STAR_LINE])
export const quiet = (id: number): PaneNode => pane(id, [QUIET_LINE])

export const row = (first: PaneNode, second: PaneNode): PaneNode => ({
  kind: "split",
  dir: "row",
  children: [first, second],
})

export const column = (first: PaneNode, second: PaneNode): PaneNode => ({
  kind: "split",
  dir: "column",
  children: [first, second],
})

export const state = (input: InitialStateInput): TrainerState => initialState(input)

export const onePane = (): TrainerState => state({ root: pane(0), activePaneId: 0 })

/** A prompt solved once the engine has recorded the named action. */
export function actionPrompt(
  id: string,
  text: string,
  par: number,
  action: Parameters<typeof did>[1],
  start: () => TrainerState = onePane,
): DrillPrompt {
  return { id, text, par, start, solved: (next) => did(next, action) }
}

/** Focus prompts: the starred pane must end up active. */
export function focusPrompt(
  id: string,
  root: PaneNode,
  activePaneId: number,
  targetPaneId: number,
  par = 2,
): DrillPrompt {
  return {
    id,
    text: "focus the ★ pane",
    par,
    start: () => state({ root, activePaneId }),
    solved: (next) => next.activePaneId === targetPaneId,
  }
}

/** Swap prompts: the starting pane must end up at the given leaf position. */
export function swapPrompt(
  id: string,
  text: string,
  root: PaneNode,
  activePaneId: number,
  finalPosition: number,
): DrillPrompt {
  return {
    id,
    text,
    par: 2,
    start: () => state({ root, activePaneId }),
    solved: (next, start) =>
      did(next, "swapped-pane") && leaves(next.root)[finalPosition]?.id === start.activePaneId,
  }
}

/** Tab prompts: the tab strip must end on the expected index. */
export function tabPrompt(
  id: string,
  text: string,
  tabs: number,
  activeTab: number,
  expectedTab: number,
): DrillPrompt {
  return {
    id,
    text,
    par: 2,
    start: () => state({ root: pane(0), activePaneId: 0, tabs, activeTab }),
    solved: (next) => did(next, "switched-tab") && next.activeTab === expectedTab,
  }
}
