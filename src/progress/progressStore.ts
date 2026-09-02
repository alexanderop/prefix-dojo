import { bestScoreKey, loadBestScore, type ScoreStorage } from "../drills/scoreStore"
import { lessons } from "../lessons"

export const CURRENT_LESSON_STORAGE_KEY = "prefix-dojo/current"
export const COMPLETED_LESSONS_STORAGE_KEY = "prefix-dojo/completed"

export interface ProgressStorage extends ScoreStorage {
  readonly length: number
  key: (index: number) => string | null
  removeItem: (key: string) => void
}

export interface ProgressSnapshot {
  readonly version: 1
  readonly currentLessonSlug: string
  readonly completedLessonSlugs: ReadonlyArray<string>
  readonly drillBestScores: Readonly<Record<string, number>>
}

export type ImportProgressResult =
  | { readonly kind: "success"; readonly snapshot: ProgressSnapshot }
  | { readonly kind: "error"; readonly message: string }

export type ResetProgressResult =
  { readonly kind: "success" } | { readonly kind: "error"; readonly message: string }

const firstLesson = lessons[0]

if (firstLesson === undefined) {
  throw new Error("The course needs at least one lesson")
}

const lessonSlugs = new Set(lessons.map((lesson) => lesson.slug))
const DRILL_STORAGE_PREFIX = "prefix-dojo/drills/"
const drillIds = new Set(
  lessons.flatMap((lesson) => (lesson.drill === undefined ? [] : [lesson.drill.id])),
)

function emptyProgress(): ProgressSnapshot {
  return {
    version: 1,
    currentLessonSlug: firstLesson.slug,
    completedLessonSlugs: [],
    drillBestScores: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function loadCompletedLessonSlugs(storage: ProgressStorage): ReadonlyArray<string> {
  try {
    const raw = storage.getItem(COMPLETED_LESSONS_STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return [
      ...new Set(
        parsed.filter(
          (value): value is string => typeof value === "string" && lessonSlugs.has(value),
        ),
      ),
    ]
  } catch {
    return []
  }
}

/** Reads the complete account-free learner state from browser storage. */
export function loadProgress(storage: ProgressStorage): ProgressSnapshot {
  try {
    const storedCurrentLesson = storage.getItem(CURRENT_LESSON_STORAGE_KEY)
    const currentLessonSlug =
      storedCurrentLesson !== null && lessonSlugs.has(storedCurrentLesson)
        ? storedCurrentLesson
        : firstLesson.slug
    const drillBestScores: Record<string, number> = {}

    for (const drillId of drillIds) {
      const score = loadBestScore(storage, bestScoreKey(drillId))
      if (score > 0) drillBestScores[drillId] = score
    }

    return {
      version: 1,
      currentLessonSlug,
      completedLessonSlugs: loadCompletedLessonSlugs(storage),
      drillBestScores,
    }
  } catch {
    return emptyProgress()
  }
}

/** Produces the portable JSON file downloaded by the learner. */
export function exportProgress(storage: ProgressStorage): string {
  return `${JSON.stringify(loadProgress(storage), null, 2)}\n`
}

function parseProgressJson(contents: string): ImportProgressResult {
  let value: unknown

  try {
    value = JSON.parse(contents)
  } catch {
    return { kind: "error", message: "That file is not valid JSON." }
  }

  if (!isRecord(value) || value.version !== 1) {
    return { kind: "error", message: "That file is not a Prefix Dojo progress backup." }
  }
  if (typeof value.currentLessonSlug !== "string") {
    return { kind: "error", message: "The backup has no valid current lesson." }
  }
  if (
    !Array.isArray(value.completedLessonSlugs) ||
    !value.completedLessonSlugs.every((slug) => typeof slug === "string")
  ) {
    return { kind: "error", message: "The backup has invalid completed lessons." }
  }
  if (!isRecord(value.drillBestScores)) {
    return { kind: "error", message: "The backup has invalid drill scores." }
  }

  const drillBestScores: Record<string, number> = {}
  for (const [drillId, score] of Object.entries(value.drillBestScores)) {
    if (typeof score !== "number" || !Number.isSafeInteger(score) || score < 0) {
      return { kind: "error", message: "The backup has invalid drill scores." }
    }
    if (drillIds.has(drillId) && score > 0) drillBestScores[drillId] = score
  }

  return {
    kind: "success",
    snapshot: {
      version: 1,
      currentLessonSlug: lessonSlugs.has(value.currentLessonSlug)
        ? value.currentLessonSlug
        : firstLesson.slug,
      completedLessonSlugs: [
        ...new Set(value.completedLessonSlugs.filter((slug) => lessonSlugs.has(slug))),
      ],
      drillBestScores,
    },
  }
}

function replaceProgress(storage: ProgressStorage, snapshot: ProgressSnapshot): void {
  storage.setItem(CURRENT_LESSON_STORAGE_KEY, snapshot.currentLessonSlug)
  storage.setItem(COMPLETED_LESSONS_STORAGE_KEY, JSON.stringify(snapshot.completedLessonSlugs))

  for (const key of storedDrillKeys(storage)) storage.removeItem(key)
  for (const drillId of drillIds) {
    const score = snapshot.drillBestScores[drillId]
    if (score !== undefined) storage.setItem(bestScoreKey(drillId), JSON.stringify(score))
  }
}

function storedDrillKeys(storage: ProgressStorage): ReadonlyArray<string> {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(DRILL_STORAGE_PREFIX)) keys.push(key)
  }
  return keys
}

/** Validates and replaces local progress only after the whole backup parses. */
export function importProgress(storage: ProgressStorage, contents: string): ImportProgressResult {
  const parsed = parseProgressJson(contents)
  if (parsed.kind === "error") return parsed

  try {
    replaceProgress(storage, parsed.snapshot)
    return parsed
  } catch {
    return { kind: "error", message: "The browser could not save the imported progress." }
  }
}

/** Removes every Prefix Dojo course and drill progress key. */
export function resetProgress(storage: ProgressStorage): ResetProgressResult {
  try {
    storage.removeItem(CURRENT_LESSON_STORAGE_KEY)
    storage.removeItem(COMPLETED_LESSONS_STORAGE_KEY)
    for (const key of storedDrillKeys(storage)) storage.removeItem(key)
    return { kind: "success" }
  } catch {
    return { kind: "error", message: "The browser could not reset the saved progress." }
  }
}
