<script setup lang="ts">
import { computed } from "vue"
import type { Lesson } from "../lessons"
import { renderKeys } from "../lib/keycaps"

const props = defineProps<{
  lesson: Lesson
  keystrokes: number
  elapsed: number
  isLast: boolean
  next: () => void
  retry: () => void
}>()

const takeawayHtml = computed(() => renderKeys(props.lesson.takeaway))
</script>

<template>
  <div class="victory sheet">
    <div class="victory-card sheet-card">
      <div class="sheet-main">
        <p class="victory-head">LESSON CLEARED</p>
        <p class="victory-takeaway" v-html="takeawayHtml"></p>
      </div>
      <div class="sheet-side">
        <p v-if="lesson.input === 'keyboard'" class="victory-stats">
          {{ keystrokes }} keys<span v-if="lesson.par !== undefined"> · par {{ lesson.par }}</span>
          · {{ elapsed.toFixed(1) }}s
        </p>
        <button v-if="!isLast" class="victory-next" @click="next">
          next lesson <kbd>enter</kbd>
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
  margin-bottom: 4px;
  font-size: 18px;
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
