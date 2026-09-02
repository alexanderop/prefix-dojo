<script setup lang="ts">
import { computed } from "vue"
import type { TrainerState } from "../engine/multiplexer"
import type { Lesson } from "../lessons"
import { renderKeys } from "../lib/keycaps"

const props = defineProps<{
  lesson: Lesson
  state: TrainerState
  position: { current: number; total: number }
  reset: () => void
}>()

const taskHtml = computed(() => renderKeys(props.lesson.task))
const bodyHtml = computed(() => renderKeys(props.lesson.body))
const steps = computed(
  () =>
    props.lesson.steps?.map((step) => ({
      html: renderKeys(step.text),
      done: step.done(props.state),
    })) ?? [],
)
</script>

<template>
  <div class="brief">
    <div class="brief-head">
      <h2 class="lesson-title">{{ lesson.title }}</h2>
      <p class="lesson-meta">{{ lesson.keymap }} · {{ position.current }} / {{ position.total }}</p>
      <button class="reset" @click="reset">↺ reset</button>
    </div>
    <!-- Lesson HTML only interpolates our own text into <kbd> tags. -->
    <p class="lesson-task"><span>DO</span> <span v-html="taskHtml"></span></p>
    <p class="lesson-body" v-html="bodyHtml"></p>
    <ol v-if="steps.length > 0" class="lesson-steps" aria-label="exercise steps">
      <li v-for="(step, index) in steps" :key="index" :class="{ complete: step.done }">
        <span class="step-marker" aria-hidden="true">{{ step.done ? "✓" : index + 1 }}</span>
        <span v-html="step.html"></span>
      </li>
    </ol>
    <slot />
  </div>
</template>

<style scoped>
.brief-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.lesson-meta {
  margin: 0 0 0 auto;
  color: var(--faint2);
  font-size: 10.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.lesson-title {
  margin: 0;
  font-family: var(--disp);
  font-size: 22px;
  font-weight: 800;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.reset {
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--faint);
  font: inherit;
  font-size: 10.5px;
  padding: 3px 9px;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.reset:hover {
  color: var(--ink);
  border-color: var(--faint);
}
.lesson-task {
  margin: 8px 0 0;
  max-width: 92ch;
  line-height: 1.7;
  color: var(--ink);
  font-family: var(--body);
  font-size: 15.5px;
}
.lesson-task :deep(kbd) {
  font-size: 13px;
  padding: 1px 8px;
}
.lesson-task > span:first-child {
  display: inline-block;
  margin-right: 10px;
  padding: 2px 7px;
  vertical-align: 2px;
  color: var(--spot-ink);
  background: var(--spot);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
}
.lesson-steps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: min(1100px, 100%);
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.lesson-steps li {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--line2);
  background: var(--panel);
  color: var(--faint);
  font-family: var(--body);
  font-size: 11.5px;
  line-height: 1.45;
}
.lesson-steps li.complete {
  border-color: color-mix(in srgb, var(--green) 45%, var(--line2));
  color: var(--ink);
}
.lesson-steps :deep(kbd) {
  max-width: 100%;
  padding: 0 4px;
  overflow-wrap: anywhere;
  font-size: 10.5px;
}
.step-marker {
  display: grid;
  width: 19px;
  height: 19px;
  place-items: center;
  border: 1px solid var(--line2);
  color: var(--faint2);
  font-family: var(--mono);
  font-size: 9.5px;
}
.lesson-steps li.complete .step-marker {
  border-color: var(--green);
  color: var(--green);
}
.lesson-body {
  margin: 5px 0 0;
  max-width: 82ch;
  line-height: 1.6;
  color: var(--faint);
  font-family: var(--body);
  font-size: 12.5px;
}
.lesson-body :deep(kbd) {
  font-size: 11px;
}
@media (max-width: 900px) {
  .lesson-steps {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .lesson-title {
    font-size: 19px;
  }
}
</style>
