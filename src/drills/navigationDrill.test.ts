import { describe, expect, it } from "vitest"
import { applyKey, leaves, type KeyInput, type TrainerState } from "../engine/multiplexer"
import { createNavigationRound, type NavigationRoundId } from "./navigationDrill"

const prefix: KeyInput = { key: "b", ctrl: true, alt: false, shift: false }

function move(state: TrainerState, direction: string): TrainerState {
  return applyKey(
    applyKey(state, prefix, "tmux"),
    { key: `Arrow${direction}`, ctrl: false, alt: false, shift: false },
    "tmux",
  )
}

const cases: ReadonlyArray<{
  random: number
  id: NavigationRoundId
  solution: string[]
}> = [
  { random: 0, id: "right", solution: ["Right"] },
  { random: 0.17, id: "left", solution: ["Left"] },
  { random: 0.34, id: "down", solution: ["Down"] },
  { random: 0.51, id: "up", solution: ["Up"] },
  { random: 0.68, id: "down-right", solution: ["Right", "Down"] },
  { random: 0.85, id: "up-left", solution: ["Left", "Up"] },
]

describe("navigation drill", () => {
  it.each(cases)("creates a solvable $id round", ({ random, id, solution }) => {
    const round = createNavigationRound({ random: () => random, previous: null })
    const solved = solution.reduce(move, round.initialState)
    const targetMarkers = leaves(round.initialState.root)
      .flatMap((pane) => pane.lines)
      .filter((line) => line.includes("★"))

    expect(round.id).toBe(id)
    expect(round.initialState.activePaneId).not.toBe(round.targetPaneId)
    expect(targetMarkers).toHaveLength(1)
    expect(solved.activePaneId).toBe(round.targetPaneId)
  })

  it("does not repeat the previous layout", () => {
    const first = createNavigationRound({ random: () => 0, previous: null })
    const second = createNavigationRound({ random: () => 0, previous: first })

    expect(first.id).toBe("right")
    expect(second.id).toBe("left")
  })
})
