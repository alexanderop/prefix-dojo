import { DIM, RESET, YELLOW } from "../engine/ansi"
import type { PaneNode, TrainerState } from "../engine/state"
import { pickVariant, type DrillDefinition } from "./definition"

/**
 * One thing the learner is told to do inside the pane. A prompt drill
 * shuffles through its prompts for sixty seconds; the instruction and its
 * par are written into the focused pane, the way a Vim trainer writes the
 * task into the buffer.
 */
export interface DrillPrompt {
  id: string
  /** Instruction, imperative and short: "split right", "go to tab 3". */
  text: string
  /** Keystrokes a clean answer needs, prefix included. */
  par: number
  start: () => TrainerState
  solved: (state: TrainerState, start: TrainerState) => boolean
}

export interface PromptRound {
  id: string
  text: string
  par: number
  initialState: TrainerState
}

export type PromptList = readonly [DrillPrompt, ...DrillPrompt[]]

export function promptLines(text: string, par: number): string[] {
  return [`${YELLOW}▶ ${text}${RESET}`, `${DIM}par ${par} ${par === 1 ? "key" : "keys"}${RESET}`]
}

function withPromptLines(node: PaneNode, paneId: number, lines: string[]): PaneNode {
  if (node.kind === "leaf") {
    return node.id === paneId ? { ...node, lines: [...lines, ...node.lines] } : node
  }
  return {
    ...node,
    children: [
      withPromptLines(node.children[0], paneId, lines),
      withPromptLines(node.children[1], paneId, lines),
    ],
  }
}

export function createPromptRound({
  prompts,
  random,
  previous,
}: {
  prompts: PromptList
  random: () => number
  previous: PromptRound | null
}): PromptRound {
  const prompt = pickVariant(prompts, random, previous?.id ?? null)
  const start = prompt.start()
  return {
    id: prompt.id,
    text: prompt.text,
    par: prompt.par,
    initialState: {
      ...start,
      root: withPromptLines(start.root, start.activePaneId, promptLines(prompt.text, prompt.par)),
    },
  }
}

export function promptDrill({
  id,
  title,
  blurb,
  target,
  prompts,
}: {
  id: string
  title: string
  blurb: string
  target: number
  prompts: PromptList
}): DrillDefinition<PromptRound> {
  const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]))
  return {
    id,
    title,
    blurb,
    target,
    createRound: (random, previous) => createPromptRound({ prompts, random, previous }),
    roundState: (round) => round.initialState,
    par: (round) => round.par,
    solved: (state, round) => byId.get(round.id)?.solved(state, round.initialState) ?? false,
  }
}

/** Prompts from several drills, deduplicated by id, for a mixed final drill. */
export function mergePrompts(...lists: PromptList[]): PromptList {
  const merged = new Map<string, DrillPrompt>()
  for (const list of lists) for (const prompt of list) merged.set(prompt.id, prompt)
  const [first, ...rest] = [...merged.values()]
  if (first === undefined) throw new Error("a drill needs at least one prompt")
  return [first, ...rest]
}
