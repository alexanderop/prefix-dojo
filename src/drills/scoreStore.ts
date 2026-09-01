export const NAVIGATION_BEST_SCORE_KEY = "prefix-dojo/drills/tmux-navigate/v1/best"

export interface ScoreStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function loadNavigationBestScore(storage: ScoreStorage): number {
  try {
    const raw = storage.getItem(NAVIGATION_BEST_SCORE_KEY)
    if (raw === null) return 0
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0
      ? parsed
      : 0
  } catch {
    return 0
  }
}

export function saveNavigationBestScore(storage: ScoreStorage, score: number): void {
  try {
    storage.setItem(NAVIGATION_BEST_SCORE_KEY, JSON.stringify(score))
  } catch {
    // A blocked or full storage area should not interrupt a practice run.
  }
}
