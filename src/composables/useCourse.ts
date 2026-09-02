import { computed, ref } from "vue"
import { lessons, tracks, type Lesson } from "../lessons"

/** Position in the course: which lesson is open and how to move between them. */
export function useCourse() {
  const lessonIndex = ref(0)
  const lesson = computed<Lesson>(() => lessons[lessonIndex.value])
  const isLast = computed(() => lessonIndex.value === lessons.length - 1)

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

  return { lessons, tracks, lessonIndex, lesson, isLast, trackPosition, open, next }
}
