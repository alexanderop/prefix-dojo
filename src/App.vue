<script setup lang="ts">
import { computed, ref } from "vue"
import CourseIndex from "./components/CourseIndex.vue"
import DrillPanel from "./components/DrillPanel.vue"
import DrillResult from "./components/DrillResult.vue"
import KeyHelp from "./components/KeyHelp.vue"
import KeyHud from "./components/KeyHud.vue"
import LessonBrief from "./components/LessonBrief.vue"
import LessonCleared from "./components/LessonCleared.vue"
import SessionPlate from "./components/SessionPlate.vue"
import StructureMap from "./components/StructureMap.vue"
import { useCourse } from "./composables/useCourse"
import { useKeyRouter } from "./composables/useKeyRouter"
import { useProgress } from "./composables/useProgress"
import { useTrainer } from "./composables/useTrainer"
import { taskKeys } from "./engine/bindings"
import type { InputKind, Lesson } from "./lessons"

const course = useCourse()
const { completed, markCompleted } = useProgress()
const trainer = useTrainer(course.lesson, {
  onCleared: (lesson) => markCompleted(lesson.slug),
})

const drawerOpen = ref(false)
const drawerToggle = ref<HTMLButtonElement | null>(null)

function openLesson(lesson: Lesson): void {
  drawerOpen.value = false
  if (lesson.slug === course.lesson.value.slug) trainer.reset()
  else course.open(lesson)
}

function closeDrawer(): void {
  drawerOpen.value = false
  drawerToggle.value?.focus()
}

useKeyRouter({ trainer, drawerOpen, nextLesson: course.next })

const { lesson, lessons, tracks } = course
const { tool, state, done, drill } = trainer

const lessonKeys = computed(() =>
  taskKeys(
    [lesson.value.task, ...(lesson.value.steps?.map((step) => step.text) ?? [])].join(" "),
    tool.value.prefix,
  ),
)
const INPUT_CAPTIONS: Record<InputKind, string> = {
  keyboard: "use the prefix",
  mouse: "click an agent",
  shell: "type in the terminal",
}
const inputCaption = computed(() => INPUT_CAPTIONS[lesson.value.input])
const statusCaption = computed(
  () => `${drill.running.value ? "drill" : lesson.value.keymap} · ${lesson.value.input}`,
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
          :reset="trainer.reset"
        >
          <DrillPanel
            v-if="drill.definition.value"
            :definition="drill.definition.value"
            :session="drill.session.value"
            :best-score="drill.bestScore.value"
            :seconds="drill.seconds.value"
            :urgent="drill.urgent.value"
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
          :par="drill.running.value ? undefined : lesson.par"
          :elapsed="drill.running.value ? Number(drill.seconds.value) : trainer.elapsed.value"
          :open-help="trainer.openHelp"
        >
          <StructureMap :state="state" :tool="tool" />
        </KeyHud>

        <div class="plate-caption" aria-hidden="true">
          <span>{{ tool.caption }}</span>
          <span>{{ inputCaption }}</span>
        </div>

        <SessionPlate
          :tool="tool"
          :state="state"
          :done="done"
          :layout-key="`${lesson.slug}-${trainer.resetCount.value}`"
          :status-caption="statusCaption"
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
            :next="course.next"
            :retry="trainer.reset"
          />
        </SessionPlate>
      </main>
    </div>
  </div>
</template>
