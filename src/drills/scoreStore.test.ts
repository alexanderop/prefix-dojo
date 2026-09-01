import { describe, expect, it } from "vitest"
import {
  NAVIGATION_BEST_SCORE_KEY,
  loadNavigationBestScore,
  saveNavigationBestScore,
  type ScoreStorage,
} from "./scoreStore"

function memoryStorage(initial: string | null = null): ScoreStorage & { value: string | null } {
  return {
    value: initial,
    getItem() {
      return this.value
    },
    setItem(_key, value) {
      this.value = value
    },
  }
}

describe("navigation best score storage", () => {
  it.each([null, "not json", "-1", "1.5", '"8"', "null", "{}"])(
    "treats %s as no score",
    (stored) => {
      expect(loadNavigationBestScore(memoryStorage(stored))).toBe(0)
    },
  )

  it("loads a saved non-negative integer", () => {
    expect(loadNavigationBestScore(memoryStorage("12"))).toBe(12)
  })

  it("writes the score under the versioned drill key", () => {
    const storage = memoryStorage()

    saveNavigationBestScore(storage, 9)

    expect(storage.value).toBe("9")
    expect(NAVIGATION_BEST_SCORE_KEY).toBe("prefix-dojo/drills/tmux-navigate/v1/best")
  })

  it("does not let unavailable storage break the drill", () => {
    const storage: ScoreStorage = {
      getItem() {
        throw new Error("blocked")
      },
      setItem() {
        throw new Error("blocked")
      },
    }

    expect(loadNavigationBestScore(storage)).toBe(0)
    expect(() => saveNavigationBestScore(storage, 4)).not.toThrow()
  })
})
