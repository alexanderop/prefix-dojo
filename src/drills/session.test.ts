import { describe, expect, it } from "vitest"
import {
  DRILL_DURATION_MS,
  advanceDrillClock,
  createReadyDrill,
  recordDrillSuccess,
  remainingDrillMs,
  startDrill,
} from "./session"

const nextRound = (previous: string | null): string => (previous === "alpha" ? "beta" : "alpha")

describe("drill session", () => {
  it("starts a 60 second run with a fresh round", () => {
    const running = startDrill({
      session: createReadyDrill(4),
      nowMs: 1_000,
      createRound: nextRound,
    })

    expect(running).toEqual({
      kind: "running",
      previousBest: 4,
      score: 0,
      misses: 0,
      deadlineMs: 1_000 + DRILL_DURATION_MS,
      round: "alpha",
    })
  })

  it("scores a completed round and immediately creates a different one", () => {
    const running = startDrill({
      session: createReadyDrill(0),
      nowMs: 0,
      createRound: nextRound,
    })

    const next = recordDrillSuccess({
      session: running,
      nowMs: 12_000,
      createRound: nextRound,
    })

    expect(next).toMatchObject({ kind: "running", score: 1, misses: 0, round: "beta" })
  })

  it("counts an over-par solve as a miss and still moves on", () => {
    const running = startDrill({
      session: createReadyDrill(0),
      nowMs: 0,
      createRound: nextRound,
    })

    const next = recordDrillSuccess({
      session: running,
      nowMs: 12_000,
      createRound: nextRound,
      withinPar: false,
    })

    expect(next).toMatchObject({ kind: "running", score: 0, misses: 1, round: "beta" })
  })

  it("does not award a point at or after the deadline", () => {
    const running = startDrill({
      session: createReadyDrill(2),
      nowMs: 0,
      createRound: nextRound,
    })

    expect(
      recordDrillSuccess({
        session: running,
        nowMs: DRILL_DURATION_MS,
        createRound: nextRound,
      }),
    ).toEqual({
      kind: "finished",
      score: 0,
      misses: 0,
      bestScore: 2,
      isNewBest: false,
    })
  })

  it("finishes from the clock and records a strictly better score", () => {
    const running = {
      ...startDrill({
        session: createReadyDrill(1),
        nowMs: 500,
        createRound: nextRound,
      }),
      score: 3,
      misses: 2,
    }

    expect(advanceDrillClock({ session: running, nowMs: 60_499 })).toBe(running)
    expect(remainingDrillMs({ session: running, nowMs: 60_499 })).toBe(1)
    expect(advanceDrillClock({ session: running, nowMs: 60_500 })).toEqual({
      kind: "finished",
      score: 3,
      misses: 2,
      bestScore: 3,
      isNewBest: true,
    })
  })

  it("keeps the best score when retrying", () => {
    const retry = startDrill({
      session: {
        kind: "finished",
        score: 2,
        misses: 0,
        bestScore: 5,
        isNewBest: false,
      },
      nowMs: 10,
      createRound: nextRound,
    })

    expect(retry.previousBest).toBe(5)
    expect(retry.score).toBe(0)
  })
})
