import type { TrainerState } from "../engine/state"

/**
 * A timed drill a lesson can offer. The session bookkeeping in `session.ts`
 * is generic; this is the part that differs per drill.
 */
export interface DrillDefinition<Round = unknown> {
  /** Stable id, also the storage key for the best score. */
  id: string
  title: string
  blurb: string
  /** Builds the next round; `previous` lets a drill avoid repeating itself. */
  createRound(random: () => number, previous: Round | null): Round
  roundState(round: Round): TrainerState
  solved(state: TrainerState, round: Round): boolean
}
