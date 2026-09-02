<script setup lang="ts">
import type { DrillDefinition } from "../drills/definition"
import type { DrillSession } from "../drills/session"

defineProps<{
  definition: DrillDefinition
  session: DrillSession<unknown>
  bestScore: number
  seconds: string
  urgent: boolean
  start: () => void
  exit: () => void
}>()
</script>

<template>
  <section
    v-if="session.kind !== 'finished'"
    class="drill-panel"
    :class="{ active: session.kind === 'running' }"
    :aria-label="definition.title"
  >
    <template v-if="session.kind === 'ready'">
      <div class="drill-intro">
        <span class="drill-eyebrow">{{ definition.title }}</span>
        <span>{{ definition.blurb }}</span>
      </div>
      <div class="drill-launch">
        <span>best {{ bestScore }}</span>
        <button class="drill-start" @click="start">start drill</button>
      </div>
    </template>
    <template v-else-if="session.kind === 'running'">
      <div class="drill-metric" :class="{ urgent }">
        <span>time</span>
        <strong>{{ seconds }}</strong>
      </div>
      <div class="drill-metric" aria-live="polite">
        <span>score</span>
        <strong :key="session.score" class="drill-score-value">{{ session.score }}</strong>
      </div>
      <div class="drill-metric">
        <span>best</span>
        <strong>{{ bestScore }}</strong>
      </div>
      <button class="drill-exit" @click="exit">exit</button>
    </template>
  </section>
</template>

<style scoped>
.drill-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  width: min(920px, 100%);
  margin-top: 12px;
  border: 1px solid var(--line2);
  background: var(--panel);
  padding: 9px 12px;
}
.drill-panel.active {
  border-color: var(--yellow);
}
.drill-intro {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--faint);
  font-family: var(--body);
  font-size: 12.5px;
}
.drill-eyebrow {
  color: var(--yellow);
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.drill-launch {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 auto;
  color: var(--faint2);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.drill-start,
.drill-exit {
  border: 1px solid var(--yellow);
  background: transparent;
  color: var(--yellow);
  font: inherit;
  cursor: pointer;
}
.drill-start {
  padding: 6px 13px;
  font-weight: 700;
}
.drill-start:hover,
.drill-start:focus-visible {
  background: var(--yellow);
  color: var(--spot-ink);
  outline: none;
}
.drill-metric {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 110px;
}
.drill-metric span {
  color: var(--faint2);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.drill-metric strong {
  color: var(--ink);
  font-family: var(--disp);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}
.drill-metric.urgent strong {
  color: var(--red);
}
.drill-score-value {
  animation: score-pop 180ms ease-out;
}
@keyframes score-pop {
  50% {
    color: var(--green);
    transform: scale(1.28);
  }
}
.drill-exit {
  margin-left: auto;
  border-color: var(--line2);
  color: var(--faint);
  padding: 5px 9px;
  font-size: 10.5px;
}
.drill-exit:hover,
.drill-exit:focus-visible {
  border-color: var(--red);
  color: var(--red);
  outline: none;
}
@media (max-width: 560px) {
  .drill-panel {
    align-items: stretch;
    flex-direction: column;
  }
  .drill-panel.active {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
  .drill-panel.active .drill-exit {
    grid-column: 1 / -1;
    margin: 0;
  }
  .drill-launch {
    justify-content: space-between;
  }
}
@media (prefers-reduced-motion: reduce) {
  .drill-score-value {
    animation: none;
  }
}
</style>
