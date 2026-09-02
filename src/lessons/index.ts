/**
 * The course, in order. Each track lives in its own file; a lesson is data
 * plus two pure functions (`setup`, `goal`), so adding one never touches the
 * engine or the UI.
 */
import { herdrLessons } from "./herdr"
import { tmuxLessons } from "./tmux"
import type { Lesson, Track } from "./types"

export type { InputKind, Lesson, LessonStep, Track } from "./types"

export const lessons: Lesson[] = [...tmuxLessons, ...herdrLessons]

export interface Module {
  name: string
  items: Lesson[]
}

export interface TrackGroup {
  name: Track
  label: string
  items: Lesson[]
  modules: Module[]
}

const TRACK_LABELS: Record<Track, string> = { tmux: "tmux", herdr: "Herdr" }

/** Consecutive lessons that share a module name, in course order. */
export function groupModules(items: Lesson[]): Module[] {
  const groups: Module[] = []
  for (const item of items) {
    const current = groups.at(-1)
    if (current?.name === item.module) current.items.push(item)
    else groups.push({ name: item.module, items: [item] })
  }
  return groups
}

export const tracks: TrackGroup[] = (Object.keys(TRACK_LABELS) as Track[]).map((name) => {
  const items = lessons.filter((item) => item.track === name)
  return { name, label: TRACK_LABELS[name], items, modules: groupModules(items) }
})
