<script setup lang="ts">
import { computed } from "vue"
import type { Lesson } from "../lessons"
import { renderKeys } from "../lib/keycaps"

const props = defineProps<{
  lesson: Lesson
  keystrokes: number
  elapsed: number
  isLast: boolean
  nextTitle: string | null
  next: () => void
  retry: () => void
}>()

const takeawayHtml = computed(() => renderKeys(props.lesson.takeaway))
const withinPar = computed(
  () => props.lesson.par !== undefined && props.keystrokes <= props.lesson.par,
)
</script>

<template>
  <div class="victory sheet">
    <div class="victory-card sheet-card">
      <div class="sheet-main">
        <p class="victory-head">
          LESSON CLEARED
          <span v-if="withinPar" class="victory-badge">clean · within par</span>
        </p>
        <p class="victory-remember">remember</p>
        <p class="victory-takeaway" v-html="takeawayHtml"></p>
      </div>
      <div class="sheet-side">
        <p v-if="lesson.input === 'keyboard'" class="victory-stats">
          {{ keystrokes }} keys<span v-if="lesson.par !== undefined"> · par {{ lesson.par }}</span>
          · {{ elapsed.toFixed(1) }}s
        </p>
        <button v-if="!isLast" class="victory-next" @click="next">
          <span class="victory-next-label">next <kbd>enter</kbd></span>
          <span v-if="nextTitle" class="victory-next-title">{{ nextTitle }}</span>
        </button>
        <p v-else class="victory-stats">
          You can now build, leave, and automate a Herdr workspace.
        </p>
        <button class="victory-again" @click="retry">try again</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.victory.sheet {
  align-items: end;
  background: linear-gradient(to bottom, rgba(17, 17, 27, 0) 30%, rgba(17, 17, 27, 0.9) 100%);
  animation: rise 220ms ease;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
.sheet-card {
  width: calc(100% - 24px);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 24px;
  text-align: left;
  padding: 16px 22px;
}
.sheet-main {
  flex: 1;
  min-width: 0;
}
.sheet-main .victory-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 18px;
}
.victory-badge {
  padding: 2px 7px;
  color: var(--spot-ink);
  background: var(--green);
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.victory-remember {
  margin: 0 0 2px;
  color: var(--faint2);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.victory-next {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
}
.victory-next-label kbd {
  margin-left: 4px;
  font-size: 10px;
  color: inherit;
  border-color: currentColor;
  background: transparent;
}
.victory-next-title {
  font-family: var(--body);
  font-size: 11.5px;
  font-weight: 400;
  opacity: 0.85;
}
.victory-takeaway {
  margin: 0;
  color: var(--fg);
  font-family: var(--body);
  font-size: 13.5px;
  line-height: 1.6;
}
.sheet-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex: 0 0 auto;
}
.sheet-side .victory-stats {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.victory-again {
  border: none;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}
.victory-again:hover {
  color: var(--fg);
}
@media (max-width: 900px) {
  .sheet-card {
    flex-direction: column;
    align-items: stretch;
  }
  .sheet-side {
    align-items: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .victory {
    animation: none;
  }
}
</style>
