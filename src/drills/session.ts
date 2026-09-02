export const DRILL_DURATION_MS = 60_000

export interface ReadyDrillSession {
  kind: "ready"
  bestScore: number
}

export interface RunningDrillSession<Round> {
  kind: "running"
  previousBest: number
  /** Rounds solved within par. */
  score: number
  /** Rounds solved, but with more keys than par. */
  misses: number
  deadlineMs: number
  round: Round
}

export interface FinishedDrillSession {
  kind: "finished"
  score: number
  misses: number
  bestScore: number
  isNewBest: boolean
}

export type IdleDrillSession = ReadyDrillSession | FinishedDrillSession

export type DrillSession<Round> = IdleDrillSession | RunningDrillSession<Round>

type CreateRound<Round> = (previous: Round | null) => Round

export function createReadyDrill(bestScore: number): ReadyDrillSession {
  return { kind: "ready", bestScore }
}

export function startDrill<Round>({
  session,
  nowMs,
  createRound,
}: {
  session: IdleDrillSession
  nowMs: number
  createRound: CreateRound<Round>
}): RunningDrillSession<Round> {
  return {
    kind: "running",
    previousBest: session.bestScore,
    score: 0,
    misses: 0,
    deadlineMs: nowMs + DRILL_DURATION_MS,
    round: createRound(null),
  }
}

export function finishDrill<Round>(session: RunningDrillSession<Round>): FinishedDrillSession {
  const isNewBest = session.score > session.previousBest
  return {
    kind: "finished",
    score: session.score,
    misses: session.misses,
    bestScore: isNewBest ? session.score : session.previousBest,
    isNewBest,
  }
}

export function advanceDrillClock<Round>({
  session,
  nowMs,
}: {
  session: RunningDrillSession<Round>
  nowMs: number
}): RunningDrillSession<Round> | FinishedDrillSession {
  return nowMs < session.deadlineMs ? session : finishDrill(session)
}

/**
 * Moves to the next round after a solve. Only a solve within par scores;
 * an over-par solve is counted as a miss so the learner sees the fumble.
 */
export function recordDrillSuccess<Round>({
  session,
  nowMs,
  createRound,
  withinPar = true,
}: {
  session: RunningDrillSession<Round>
  nowMs: number
  createRound: CreateRound<Round>
  withinPar?: boolean
}): RunningDrillSession<Round> | FinishedDrillSession {
  if (nowMs >= session.deadlineMs) return finishDrill(session)
  return {
    ...session,
    score: withinPar ? session.score + 1 : session.score,
    misses: withinPar ? session.misses : session.misses + 1,
    round: createRound(session.round),
  }
}

export function remainingDrillMs<Round>({
  session,
  nowMs,
}: {
  session: RunningDrillSession<Round>
  nowMs: number
}): number {
  return Math.max(0, session.deadlineMs - nowMs)
}
