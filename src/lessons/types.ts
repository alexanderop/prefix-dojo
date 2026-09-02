import type { DrillDefinition } from "../drills/definition"
import type { Keymap, TrainerState } from "../engine/multiplexer"

export type Track = "tmux" | "herdr"
export type InputKind = "keyboard" | "mouse" | "shell"

export interface LessonStep {
  text: string
  done: (state: TrainerState) => boolean
}

export interface Lesson {
  slug: string
  track: Track
  module: string
  title: string
  /** Text in square brackets renders as a keycap or command. */
  body: string
  task: string
  steps?: ReadonlyArray<LessonStep>
  takeaway: string
  keymap: Keymap
  input: InputKind
  /** Keystroke count a clean solution needs; shown next to the counter. */
  par?: number
  /** Optional timed drill the lesson offers once its layout is understood. */
  drill?: DrillDefinition
  setup: () => TrainerState
  goal: (state: TrainerState) => boolean
}
