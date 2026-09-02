import { DIM, RESET, YELLOW } from "../engine/ansi"
import { initialState, leaf, type PaneNode, type TrainerState } from "../engine/multiplexer"
import type { DrillDefinition } from "./definition"

export type NavigationRoundId = "right" | "left" | "down" | "up" | "down-right" | "up-left"

export interface NavigationRound {
  id: NavigationRoundId
  initialState: TrainerState
  targetPaneId: number
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
): Omit<NavigationRound, "id"> {
  return {
    initialState: initialState({ root, activePaneId }),
    targetPaneId,
  }
}

const navigationVariants = [
  {
    id: "right",
    build: () => round(row(pane(0, "start"), pane(1, "target")), 0, 1),
  },
  {
    id: "left",
    build: () => round(row(pane(0, "target"), pane(1, "start")), 1, 0),
  },
  {
    id: "down",
    build: () => round(column(pane(0, "start"), pane(1, "target")), 0, 1),
  },
  {
    id: "up",
    build: () => round(column(pane(0, "target"), pane(1, "start")), 1, 0),
  },
  {
    id: "down-right",
    build: () =>
      round(row(column(pane(0, "start"), pane(1)), column(pane(2), pane(3, "target"))), 0, 3),
  },
  {
    id: "up-left",
    build: () =>
      round(row(column(pane(0, "target"), pane(1)), column(pane(2), pane(3, "start"))), 3, 0),
  },
] satisfies readonly [NavigationVariant, ...NavigationVariant[]]

export function createNavigationRound({
  random,
  previous,
}: {
  random: () => number
  previous: NavigationRound | null
}): NavigationRound {
  const randomIndex = Math.floor(random() * navigationVariants.length)
  const boundedIndex = Math.max(0, Math.min(navigationVariants.length - 1, randomIndex))
  const previousIndex =
    previous === null ? -1 : navigationVariants.findIndex((variant) => variant.id === previous.id)
  const index =
    boundedIndex === previousIndex ? (boundedIndex + 1) % navigationVariants.length : boundedIndex
  const variant = navigationVariants.at(index) ?? navigationVariants[0]
  return { id: variant.id, ...variant.build() }
}

export const navigationDrill: DrillDefinition<NavigationRound> = {
  id: "tmux-navigate",
  title: "60 second drill",
  blurb: "Reach as many randomized starred panes as you can.",
  createRound: (random, previous) => createNavigationRound({ random, previous }),
  roundState: (round) => round.initialState,
  solved: (state, round) => state.activePaneId === round.targetPaneId,
}
