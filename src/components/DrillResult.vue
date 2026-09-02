<script setup lang="ts">
import type { FinishedDrillSession } from "../drills/session"

defineProps<{
  title: string
  target: number
  session: FinishedDrillSession
  retry: () => void
  back: () => void
}>()
</script>

<template>
  <div class="victory" role="dialog" aria-modal="true" aria-labelledby="drill-result-title">
    <div class="victory-card drill-result-card">
      <p class="drill-result-kicker">{{ title }}</p>
      <p id="drill-result-title" class="victory-head">
        {{ session.isNewBest ? (session.bestScore >= target ? "CLEARED" : "NEW BEST") : "TIME" }}
      </p>
      <p class="drill-result-score">{{ session.score }}</p>
      <p class="victory-stats">
        {{ session.score === 1 ? "clean round" : "clean rounds" }}
        <template v-if="session.misses > 0"> · {{ session.misses }} over par</template>
        · best {{ session.bestScore }} · target {{ target }}
      </p>
      <div class="drill-result-actions">
        <button class="victory-next" @click="retry">retry <kbd>enter</kbd></button>
        <button class="drill-back" @click="back">back to lesson <kbd>esc</kbd></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drill-result-card {
  max-width: 480px;
}
.drill-result-kicker {
  margin: 0 0 4px;
  color: var(--yellow);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.drill-result-score {
  margin: -4px 0 2px;
  color: var(--ink);
  font-family: var(--disp);
  font-size: 72px;
  font-weight: 800;
  line-height: 0.95;
}
.drill-result-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.drill-back {
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--faint);
  font: inherit;
  padding: 8px 14px;
  cursor: pointer;
}
.drill-back:hover,
.drill-back:focus-visible {
  border-color: var(--red);
  color: var(--red);
  outline: none;
}
.drill-result-actions kbd {
  margin-left: 5px;
  font-size: 10px;
}
@media (max-width: 560px) {
  .drill-result-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
