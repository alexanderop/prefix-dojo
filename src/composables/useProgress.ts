import { ref } from "vue"
import { lessons } from "../lessons"

const STORAGE_KEY = "prefix-dojo/completed"

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    const currentSlugs = new Set(lessons.map((item) => item.slug))
    return new Set(
      parsed.filter(
        (value): value is string => typeof value === "string" && currentSlugs.has(value),
      ),
    )
  } catch {
    return new Set()
  }
}

/** Which lessons the learner has cleared, persisted per browser. */
export function useProgress() {
  const completed = ref<Set<string>>(load())

  function markCompleted(slug: string): void {
    if (completed.value.has(slug)) return
    completed.value = new Set([...completed.value, slug])
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed.value]))
    } catch {
      /* progress just won't persist */
    }
  }

  return { completed, markCompleted }
}
