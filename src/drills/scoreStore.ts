export interface ScoreStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function bestScoreKey(drillId: string): string {
  return `prefix-dojo/drills/${drillId}/v1/best`
}

export function loadBestScore(storage: ScoreStorage, key: string): number {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return 0
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function saveBestScore(storage: ScoreStorage, key: string, score: number): void {
  try {
    storage.setItem(key, JSON.stringify(score))
  } catch {
    // A blocked or full storage area should not interrupt a practice run.
  }
}
