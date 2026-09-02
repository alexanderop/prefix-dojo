import { describe, expect, it } from "vitest"
import { applyKey, leaves, type KeyInput, type TrainerState } from "../engine/multiplexer"
import type { DrillDefinition } from "./definition"
import { herdrHistoryDrill, herdrMixedDrill, herdrPaneDrill, herdrTabDrill } from "./herdrDrills"
import { createPromptRound, type DrillPrompt, type PromptRound } from "./promptDrill"
import { tmuxMixedDrill, tmuxPaneDrill, tmuxWindowDrill } from "./tmuxDrills"

function key(value: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return { key: value, ctrl: false, alt: false, shift: false, ...modifiers }
}

const prefix = key("b", { ctrl: true })
const typed = (text: string): KeyInput[] => [...text].map((char) => key(char))

/** Clean answers per prompt id; a prompt shared by several drills has one answer. */
const answers: Record<"tmux" | "herdr", Record<string, KeyInput[]>> = {
  tmux: {
    "split-right": [prefix, key("%")],
    "split-down": [prefix, key('"')],
    "focus-right": [prefix, key("ArrowRight")],
    "focus-left": [prefix, key("ArrowLeft")],
    "focus-down": [prefix, key("ArrowDown")],
    "focus-up": [prefix, key("ArrowUp")],
    cycle: [prefix, key("o")],
    zoom: [prefix, key("z")],
    "close-pane": [prefix, key("x")],
    "new-window": [prefix, key("c")],
    "next-window": [prefix, key("n")],
    "previous-window": [prefix, key("p")],
    "window-0": [prefix, key("0")],
    "window-2": [prefix, key("2")],
    "window-3": [prefix, key("3")],
    "copy-mode": [prefix, key("[")],
    "copy-selection": [prefix, key("["), key(" "), key("Enter")],
    detach: [prefix, key("d")],
  },
  herdr: {
    "split-right": [prefix, key("v")],
    "split-down": [prefix, key("-")],
    "focus-right": [prefix, key("l")],
    "focus-left": [prefix, key("h")],
    "focus-down": [prefix, key("j")],
    "focus-up": [prefix, key("k")],
    "swap-right": [prefix, key("L", { shift: true })],
    "swap-left": [prefix, key("H", { shift: true })],
    "swap-down": [prefix, key("J", { shift: true })],
    cycle: [prefix, key("Tab")],
    zoom: [prefix, key("z")],
    "close-pane": [prefix, key("x")],
    "new-tab": [prefix, key("c")],
    "next-tab": [prefix, key("n")],
    "previous-tab": [prefix, key("p")],
    "tab-1": [prefix, key("1")],
    "tab-3": [prefix, key("3")],
    "tab-4": [prefix, key("4")],
    "close-tab": [prefix, key("X", { shift: true })],
    "new-workspace": [prefix, key("N", { shift: true })],
    "switch-workspace": [prefix, key("w"), key("ArrowDown"), key("Enter")],
    "close-workspace": [prefix, key("D", { shift: true })],
    "copy-mode": [prefix, key("[")],
    "copy-selection": [prefix, key("["), key("v"), key("y")],
    "search-error": [prefix, key("["), key("/"), ...typed("error"), key("Enter")],
    "search-warn": [prefix, key("["), key("/"), ...typed("warn"), key("Enter")],
    goto: [prefix, key("g")],
    sidebar: [prefix, key("b")],
    notification: [prefix, key("o")],
    detach: [prefix, key("q")],
  },
}

const drills: ReadonlyArray<{ keymap: "tmux" | "herdr"; drill: DrillDefinition<PromptRound> }> = [
  { keymap: "tmux", drill: tmuxPaneDrill },
  { keymap: "tmux", drill: tmuxWindowDrill },
  { keymap: "tmux", drill: tmuxMixedDrill },
  { keymap: "herdr", drill: herdrPaneDrill },
  { keymap: "herdr", drill: herdrTabDrill },
  { keymap: "herdr", drill: herdrHistoryDrill },
  { keymap: "herdr", drill: herdrMixedDrill },
]

/** Walks every prompt by feeding `random` values that land on each index. */
function everyRound(drill: DrillDefinition<PromptRound>): PromptRound[] {
  const rounds: PromptRound[] = []
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const round = drill.createRound(() => (attempt % 64) / 64, null)
    if (!rounds.some((seen) => seen.id === round.id)) rounds.push(round)
  }
  return rounds
}

describe.each(drills)("$drill.id drill", ({ keymap, drill }) => {
  const rounds = everyRound(drill)

  it("has at least four prompts", () => {
    expect(rounds.length).toBeGreaterThanOrEqual(4)
  })

  it.each(rounds)("writes the $id prompt into the focused pane", (round) => {
    const active = leaves(round.initialState.root).find(
      (pane) => pane.id === round.initialState.activePaneId,
    )
    expect(active?.lines[0]).toContain(round.text)
    expect(active?.lines[1]).toContain(`par ${round.par}`)
    expect(drill.par(round)).toBe(round.par)
    expect(drill.solved(round.initialState, round)).toBe(false)
  })

  it.each(rounds)("solves the $id prompt exactly at par", (round) => {
    const answer = answers[keymap][round.id]
    expect(answer, `no answer for ${keymap} ${round.id}`).toBeDefined()
    if (answer === undefined) return
    const solved = answer.reduce(
      (state: TrainerState, input) => applyKey(state, input, keymap),
      round.initialState,
    )
    expect(solved.rejected).toBe(false)
    expect(drill.solved(solved, round)).toBe(true)
    expect(solved.keystrokes).toBe(round.par)
  })
})

describe("prompt rounds", () => {
  const prompts: [DrillPrompt, ...DrillPrompt[]] = [
    {
      id: "a",
      text: "a",
      par: 1,
      start: () => tmuxPaneDrill.roundState(everyRound(tmuxPaneDrill)[0]),
      solved: () => true,
    },
    {
      id: "b",
      text: "b",
      par: 1,
      start: () => tmuxPaneDrill.roundState(everyRound(tmuxPaneDrill)[0]),
      solved: () => true,
    },
  ]

  it("never repeats the previous prompt", () => {
    const first = createPromptRound({ prompts, random: () => 0, previous: null })
    const second = createPromptRound({ prompts, random: () => 0, previous: first })
    expect(first.id).toBe("a")
    expect(second.id).toBe("b")
  })
})
