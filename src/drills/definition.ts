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
  /** Best score that marks the drill as cleared in the course index. */
  target: number
  /** Builds the next round; `previous` lets a drill avoid repeating itself. */
  createRound(random: () => number, previous: Round | null): Round
  roundState(round: Round): TrainerState
  /** Keystrokes a clean solution needs; a solve above this counts as a miss. */
  par(round: Round): number
  solved(state: TrainerState, round: Round): boolean
}

/**
 * Picks a variant by index from `random` in [0, 1), never the one that was
 * used last so two identical rounds never follow each other.
 */
export function pickVariant<Variant extends { id: string }>(
  variants: readonly Variant[],
  random: () => number,
  previousId: string | null,
): Variant {
  const first = variants[0]
  if (first === undefined) throw new Error("a drill needs at least one variant")
  const randomIndex = Math.floor(random() * variants.length)
  const boundedIndex = Math.max(0, Math.min(variants.length - 1, randomIndex))
  const previousIndex = variants.findIndex((variant) => variant.id === previousId)
  const index = boundedIndex === previousIndex ? (boundedIndex + 1) % variants.length : boundedIndex
  return variants.at(index) ?? first
}
