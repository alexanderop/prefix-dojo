import { DIM, RESET, YELLOW } from "../engine/ansi"
import { initialState, leaf, type PaneNode, type TrainerState } from "../engine/multiplexer"
import { pickVariant, type DrillDefinition } from "./definition"

export type NavigationRoundId = "right" | "left" | "down" | "up" | "down-right" | "up-left"

export interface NavigationRound {
  id: NavigationRoundId
  initialState: TrainerState
  targetPaneId: number
  par: number
}

interface NavigationVariant {
  id: NavigationRoundId
  build: () => Omit<NavigationRound, "id">
}

const START_LINE = `${DIM}# start here${RESET}`
const TARGET_LINE = `${YELLOW}★ focus this pane${RESET}`

function pane(id: number, marker?: "start" | "target"): PaneNode {
  const lines = marker === "start" ? [START_LINE] : marker === "target" ? [TARGET_LINE] : []
  return leaf(id, lines, "shell")
}

function row(first: PaneNode, second: PaneNode): PaneNode {
  return { kind: "split", dir: "row", children: [first, second] }
}

function column(first: PaneNode, second: PaneNode): PaneNode {
  return { kind: "split", dir: "column", children: [first, second] }
}

function round(
  root: PaneNode,
  activePaneId: number,
  targetPaneId: number,
  par: number,
): Omit<NavigationRound, "id"> {
  return {
    initialState: initialState({ root, activePaneId }),
    targetPaneId,
    par,
  }
}

const navigationVariants = [
  {
    id: "right",
    build: () => round(row(pane(0, "start"), pane(1, "target")), 0, 1, 2),
  },
  {
    id: "left",
    build: () => round(row(pane(0, "target"), pane(1, "start")), 1, 0, 2),
  },
  {
    id: "down",
    build: () => round(column(pane(0, "start"), pane(1, "target")), 0, 1, 2),
  },
  {
    id: "up",
    build: () => round(column(pane(0, "target"), pane(1, "start")), 1, 0, 2),
  },
  {
    id: "down-right",
    build: () =>
      round(row(column(pane(0, "start"), pane(1)), column(pane(2), pane(3, "target"))), 0, 3, 4),
  },
  {
    id: "up-left",
    build: () =>
      round(row(column(pane(0, "target"), pane(1)), column(pane(2), pane(3, "start"))), 3, 0, 4),
  },
] satisfies readonly [NavigationVariant, ...NavigationVariant[]]

export function createNavigationRound({
  random,
  previous,
}: {
  random: () => number
  previous: NavigationRound | null
}): NavigationRound {
  const variant = pickVariant(navigationVariants, random, previous?.id ?? null)
  return { id: variant.id, ...variant.build() }
}

export const navigationDrill: DrillDefinition<NavigationRound> = {
  id: "tmux-navigate",
  title: "Pane navigation drill",
  blurb: "Reach as many randomized starred panes as you can.",
  target: 12,
  createRound: (random, previous) => createNavigationRound({ random, previous }),
  roundState: (round) => round.initialState,
  par: (round) => round.par,
  solved: (state, round) => state.activePaneId === round.targetPaneId,
}
