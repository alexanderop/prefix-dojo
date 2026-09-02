import { describe, expect, it } from "vitest"
import { bestScoreKey } from "../drills/scoreStore"
import { lessons } from "../lessons"
import {
  COMPLETED_LESSONS_STORAGE_KEY,
  CURRENT_LESSON_STORAGE_KEY,
  exportProgress,
  importProgress,
  loadProgress,
  resetProgress,
  type ProgressStorage,
} from "./progressStore"

class MemoryStorage implements ProgressStorage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const firstLesson = lessons[0]
const secondLesson = lessons[1]
const drillDefinition = lessons.find((lesson) => lesson.drill !== undefined)?.drill

if (firstLesson === undefined || secondLesson === undefined || drillDefinition === undefined) {
  throw new Error("Progress tests require two lessons and one drill")
}

describe("local progress backups", () => {
  it("exports the last lesson, completed lessons, and drill best scores", () => {
    const storage = new MemoryStorage()
    storage.setItem(CURRENT_LESSON_STORAGE_KEY, secondLesson.slug)
    storage.setItem(COMPLETED_LESSONS_STORAGE_KEY, JSON.stringify([firstLesson.slug]))
    storage.setItem(bestScoreKey(drillDefinition.id), "7")

    const exported = JSON.parse(exportProgress(storage)) as unknown

    expect(exported).toEqual({
      version: 1,
      currentLessonSlug: secondLesson.slug,
      completedLessonSlugs: [firstLesson.slug],
      drillBestScores: { [drillDefinition.id]: 7 },
    })
  })

  it("imports a valid backup and restores it from storage", () => {
    const storage = new MemoryStorage()
    const result = importProgress(
      storage,
      JSON.stringify({
        version: 1,
        currentLessonSlug: secondLesson.slug,
        completedLessonSlugs: [firstLesson.slug, secondLesson.slug],
        drillBestScores: { [drillDefinition.id]: 9 },
      }),
    )

    expect(result.kind).toBe("success")
    expect(loadProgress(storage)).toEqual({
      version: 1,
      currentLessonSlug: secondLesson.slug,
      completedLessonSlugs: [firstLesson.slug, secondLesson.slug],
      drillBestScores: { [drillDefinition.id]: 9 },
    })
  })

  it("rejects invalid backup data without replacing saved progress", () => {
    const storage = new MemoryStorage()
    storage.setItem(CURRENT_LESSON_STORAGE_KEY, secondLesson.slug)

    const result = importProgress(
      storage,
      JSON.stringify({
        version: 1,
        currentLessonSlug: firstLesson.slug,
        completedLessonSlugs: "all of them",
        drillBestScores: {},
      }),
    )

    expect(result.kind).toBe("error")
    expect(loadProgress(storage).currentLessonSlug).toBe(secondLesson.slug)
  })

  it("keeps valid progress when one saved field is corrupt", () => {
    const storage = new MemoryStorage()
    storage.setItem(CURRENT_LESSON_STORAGE_KEY, secondLesson.slug)
    storage.setItem(COMPLETED_LESSONS_STORAGE_KEY, "not json")
    storage.setItem(bestScoreKey(drillDefinition.id), "5")

    expect(loadProgress(storage)).toEqual({
      version: 1,
      currentLessonSlug: secondLesson.slug,
      completedLessonSlugs: [],
      drillBestScores: { [drillDefinition.id]: 5 },
    })
  })

  it("ignores progress entries removed from the current course", () => {
    const storage = new MemoryStorage()
    const result = importProgress(
      storage,
      JSON.stringify({
        version: 1,
        currentLessonSlug: "retired-lesson",
        completedLessonSlugs: [firstLesson.slug, "retired-lesson"],
        drillBestScores: { [drillDefinition.id]: 4, "retired-drill": 99 },
      }),
    )

    expect(result).toEqual({
      kind: "success",
      snapshot: {
        version: 1,
        currentLessonSlug: firstLesson.slug,
        completedLessonSlugs: [firstLesson.slug],
        drillBestScores: { [drillDefinition.id]: 4 },
      },
    })
  })

  it("resets all saved course and drill progress", () => {
    const storage = new MemoryStorage()
    const imported = importProgress(
      storage,
      JSON.stringify({
        version: 1,
        currentLessonSlug: secondLesson.slug,
        completedLessonSlugs: [firstLesson.slug],
        drillBestScores: { [drillDefinition.id]: 6 },
      }),
    )
    expect(imported.kind).toBe("success")
    storage.setItem("prefix-dojo/drills/retired-drill/v1/best", "99")

    expect(resetProgress(storage)).toEqual({ kind: "success" })
    expect(loadProgress(storage)).toEqual({
      version: 1,
      currentLessonSlug: firstLesson.slug,
      completedLessonSlugs: [],
      drillBestScores: {},
    })
    expect(storage.getItem("prefix-dojo/drills/retired-drill/v1/best")).toBeNull()
  })
})
