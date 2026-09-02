import { computed, ref, watch } from "vue"
import { lessons, tracks, type Lesson } from "../lessons"
import { CURRENT_LESSON_STORAGE_KEY, loadProgress } from "../progress/progressStore"

/** The lesson that was open last time, so a reload resumes where you left off. */
function loadIndex(): number {
  const slug = loadProgress(localStorage).currentLessonSlug
  const index = lessons.findIndex((item) => item.slug === slug)
  return index === -1 ? 0 : index
}

/** Position in the course: which lesson is open and how to move between them. */
export function useCourse() {
  const lessonIndex = ref(loadIndex())
  const lesson = computed<Lesson>(() => lessons[lessonIndex.value])
  const isLast = computed(() => lessonIndex.value === lessons.length - 1)
  const nextLesson = computed<Lesson | null>(() => lessons[lessonIndex.value + 1] ?? null)
  const prevLesson = computed<Lesson | null>(() => lessons[lessonIndex.value - 1] ?? null)

  watch(lesson, (current) => {
    try {
      localStorage.setItem(CURRENT_LESSON_STORAGE_KEY, current.slug)
    } catch {
      /* the course just won't resume */
    }
  })

  const trackPosition = computed(() => {
    const items = lessons.filter((item) => item.track === lesson.value.track)
    return {
      current: items.findIndex((item) => item.slug === lesson.value.slug) + 1,
      total: items.length,
    }
  })

  function open(target: Lesson | number): void {
    lessonIndex.value = typeof target === "number" ? target : lessons.indexOf(target)
  }

  function next(): void {
    if (!isLast.value) lessonIndex.value += 1
  }

  function prev(): void {
    if (lessonIndex.value > 0) lessonIndex.value -= 1
  }

  return {
    lessons,
    tracks,
    lessonIndex,
    lesson,
    isLast,
    nextLesson,
    prevLesson,
    trackPosition,
    open,
    next,
    prev,
  }
}
