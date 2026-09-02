import { ref } from "vue"
import { COMPLETED_LESSONS_STORAGE_KEY, loadProgress } from "../progress/progressStore"

function load(): Set<string> {
  return new Set(loadProgress(localStorage).completedLessonSlugs)
}

/** Which lessons the learner has cleared, persisted per browser. */
export function useProgress() {
  const completed = ref<Set<string>>(load())

  function markCompleted(slug: string): void {
    if (completed.value.has(slug)) return
    completed.value = new Set([...completed.value, slug])
    try {
      localStorage.setItem(COMPLETED_LESSONS_STORAGE_KEY, JSON.stringify([...completed.value]))
    } catch {
      /* progress just won't persist */
    }
  }

  function restoreCompleted(slugs: ReadonlyArray<string>): void {
    completed.value = new Set(slugs)
  }

  return { completed, markCompleted, restoreCompleted }
}
