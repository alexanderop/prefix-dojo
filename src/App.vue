<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import CourseIndex from "./components/CourseIndex.vue"
import DrillPanel from "./components/DrillPanel.vue"
import DrillResult from "./components/DrillResult.vue"
import KeyHelp from "./components/KeyHelp.vue"
import KeyHud from "./components/KeyHud.vue"
import LessonBrief from "./components/LessonBrief.vue"
import LessonCleared from "./components/LessonCleared.vue"
import NextKeyGuide from "./components/NextKeyGuide.vue"
import SessionPlate from "./components/SessionPlate.vue"
import StructureMap from "./components/StructureMap.vue"
import { useCourse } from "./composables/useCourse"
import { useKeyRouter } from "./composables/useKeyRouter"
import { useProgress } from "./composables/useProgress"
import { useTrainer } from "./composables/useTrainer"
import { taskKeys } from "./engine/bindings"
import type { Lesson } from "./lessons"
import {
  exportProgress,
  importProgress,
  resetProgress,
  type ProgressSnapshot,
} from "./progress/progressStore"

const course = useCourse()
const { completed, markCompleted, restoreCompleted } = useProgress()
const trainer = useTrainer(course.lesson, {
  onCleared: (lesson) => markCompleted(lesson.slug),
})

const drawerOpen = ref(false)
const drawerToggle = ref<HTMLButtonElement | null>(null)
const progressFileInput = ref<HTMLInputElement | null>(null)
const progressMenu = ref<HTMLDetailsElement | null>(null)
const progressNotice = ref<{ kind: "success" | "error"; message: string } | null>(null)
let progressNoticeTimer: number | undefined

function openLesson(lesson: Lesson): void {
  drawerOpen.value = false
  if (lesson.slug === course.lesson.value.slug) trainer.reset()
  else course.open(lesson)
}

function closeDrawer(): void {
  drawerOpen.value = false
  drawerToggle.value?.focus()
}

function showProgressNotice(kind: "success" | "error", message: string): void {
  window.clearTimeout(progressNoticeTimer)
  progressNotice.value = { kind, message }
  progressNoticeTimer = window.setTimeout(() => (progressNotice.value = null), 5_000)
}

function closeProgressMenu(): void {
  if (progressMenu.value !== null) progressMenu.value.open = false
}

function applyProgressSnapshot(snapshot: ProgressSnapshot): void {
  restoreCompleted(snapshot.completedLessonSlugs)
  const target = course.lessons.find((lesson) => lesson.slug === snapshot.currentLessonSlug)
  if (target === undefined) return

  if (target.slug === course.lesson.value.slug) trainer.reset()
  else course.open(target)
}

function downloadProgress(): void {
  const url = URL.createObjectURL(
    new Blob([exportProgress(localStorage)], { type: "application/json" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `prefix-dojo-progress-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  closeProgressMenu()
  showProgressNotice("success", "Progress backup downloaded.")
}

function chooseProgressFile(): void {
  progressFileInput.value?.click()
}

async function restoreProgressFile(event: Event): Promise<void> {
  if (!(event.currentTarget instanceof HTMLInputElement)) return
  const input = event.currentTarget
  const file = input.files?.[0]
  input.value = ""
  if (file === undefined) return

  let contents: string
  try {
    contents = await file.text()
  } catch {
    showProgressNotice("error", "The selected file could not be read.")
    return
  }

  const result = importProgress(localStorage, contents)
  if (result.kind === "error") {
    showProgressNotice("error", result.message)
    return
  }

  applyProgressSnapshot(result.snapshot)
  closeProgressMenu()
  showProgressNotice("success", "Progress restored from backup.")
}

function clearProgress(): void {
  if (!window.confirm("Reset every completed lesson and drill score on this browser?")) return

  const result = resetProgress(localStorage)
  if (result.kind === "error") {
    showProgressNotice("error", result.message)
    return
  }

  applyProgressSnapshot({
    version: 1,
    currentLessonSlug: course.lessons[0]?.slug ?? course.lesson.value.slug,
    completedLessonSlugs: [],
    drillBestScores: {},
  })
  closeProgressMenu()
  showProgressNotice("success", "Progress reset.")
}

onBeforeUnmount(() => window.clearTimeout(progressNoticeTimer))

useKeyRouter({ trainer, drawerOpen, nextLesson: course.next })

const { lesson, lessons, tracks } = course
const { tool, state, done, drill } = trainer

const lessonKeys = computed(() =>
  taskKeys(
    [lesson.value.task, ...(lesson.value.steps?.map((step) => step.text) ?? [])].join(" "),
    tool.value.prefix,
  ),
)
</script>

<template>
  <div class="site">
    <header class="fighd">
      <h1>prefix dojo <i>·</i> learn tmux and herdr by doing</h1>
      <div class="r" :title="`${completed.size} of ${lessons.length} lessons cleared`">
        <span>{{ completed.size }} / {{ lessons.length }} cleared</span>
        <span class="progress">
          <span
            class="progress-bar"
            :style="{ width: `${(completed.size / lessons.length) * 100}%` }"
          ></span>
        </span>
        <details ref="progressMenu" class="progress-actions">
          <summary>progress</summary>
          <div class="progress-actions-menu">
            <button type="button" @click="downloadProgress">export backup</button>
            <button type="button" @click="chooseProgressFile">import backup</button>
            <button class="progress-reset" type="button" @click="clearProgress">
              reset progress
            </button>
          </div>
        </details>
        <input
          ref="progressFileInput"
          hidden
          type="file"
          accept="application/json,.json"
          @change="restoreProgressFile"
        />
        <button
          ref="drawerToggle"
          class="lesson-drawer-toggle"
          type="button"
          aria-controls="lesson-drawer"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = !drawerOpen"
        >
          {{ drawerOpen ? "close" : "lessons" }}
        </button>
      </div>
    </header>

    <div class="layout">
      <CourseIndex
        :open="drawerOpen"
        :tracks="tracks"
        :current="lesson"
        :completed="completed"
        :close="closeDrawer"
        :select="openLesson"
      />

      <main class="stage">
        <LessonBrief
          :lesson="lesson"
          :state="state"
          :position="course.trackPosition.value"
          :next-title="course.nextLesson.value?.title ?? null"
          :prev-title="course.prevLesson.value?.title ?? null"
          :reset="trainer.reset"
          :go-next="course.next"
          :go-prev="course.prev"
        >
          <DrillPanel
            v-if="drill.definition.value"
            :definition="drill.definition.value"
            :session="drill.session.value"
            :best-score="drill.bestScore.value"
            :seconds="drill.seconds.value"
            :urgent="drill.urgent.value"
            :keyboard-start="lesson.input === 'drill'"
            :start="drill.start"
            :exit="drill.exit"
          />
        </LessonBrief>

        <KeyHud
          :mode="state.mode"
          :tool="tool"
          :input="lesson.input"
          :trail="trainer.keyTrail.value"
          :flash="trainer.flash.value"
          :keystrokes="state.keystrokes"
          :par="drill.running.value ? drill.par.value : lesson.par"
          :elapsed="drill.running.value ? Number(drill.seconds.value) : trainer.elapsed.value"
          :open-help="trainer.openHelp"
        >
          <template #guide>
            <NextKeyGuide
              :mode="state.mode"
              :tool="tool"
              :input="lesson.input"
              :state="state"
              :lesson-keys="lessonKeys"
              :done="done"
              :open-help="trainer.openHelp"
            />
          </template>
          <StructureMap :state="state" :tool="tool" />
        </KeyHud>

        <div class="plate-caption">
          <span aria-hidden="true">{{ tool.caption }}</span>
        </div>

        <SessionPlate
          :tool="tool"
          :state="state"
          :done="done"
          :layout-key="`${lesson.slug}-${trainer.resetCount.value}`"
          :focus-pane="trainer.focusPane"
          :focus-tab="trainer.focusTab"
          :focus-workspace="trainer.focusWorkspace"
          :run-shell-command="trainer.runShellCommand"
        >
          <KeyHelp
            v-if="trainer.helpVisible.value"
            :tool="tool"
            :lesson-keys="lessonKeys"
            :close="trainer.closeHelp"
          />

          <DrillResult
            v-if="drill.session.value.kind === 'finished' && drill.definition.value"
            :title="drill.definition.value.title"
            :target="drill.definition.value.target"
            :session="drill.session.value"
            :retry="drill.start"
            :back="drill.exit"
          />

          <LessonCleared
            v-else-if="done"
            :lesson="lesson"
            :keystrokes="state.keystrokes"
            :elapsed="trainer.elapsed.value"
            :is-last="course.isLast.value"
            :next-title="course.nextLesson.value?.title ?? null"
            :next="course.next"
            :retry="trainer.reset"
          />
        </SessionPlate>
      </main>
    </div>

    <p
      v-if="progressNotice"
      class="progress-notice"
      :class="`is-${progressNotice.kind}`"
      role="status"
    >
      {{ progressNotice.message }}
    </p>
  </div>
</template>
