<script setup lang="ts">
import { computed } from "vue"
import type { InputKind } from "../lessons"
import type { Tool, TrainerMode } from "../engine/multiplexer"

const props = defineProps<{
  mode: TrainerMode
  tool: Tool
  input: InputKind
  /** Keys pressed so far, newest last, in display spelling. */
  trail: string[]
  flash: "bad" | "good" | null
  keystrokes: number
  par?: number
  elapsed: number
  openHelp: () => void
}>()

const INPUT_LABELS: Record<InputKind, string> = {
  keyboard: "terminal",
  mouse: "mouse",
  shell: "shell",
  drill: "drill",
}

function labelFor(mode: TrainerMode, input: InputKind): string {
  switch (mode.kind) {
    case "terminal":
      return INPUT_LABELS[input]
    case "prefix":
      return "prefix armed"
    case "copy":
      if (mode.search?.typing) return "copy · search"
      return mode.selecting ? "copy · selecting" : "copy mode"
    case "rename":
      return `rename ${mode.target}`
    case "resize":
      return "resize mode"
    case "workspace-picker":
      return "workspaces"
    case "help":
      return "key help"
    case "goto":
      return "go to"
  }
}

const label = computed(() => labelFor(props.mode, props.input))
</script>

<template>
  <section
    class="hud"
    :class="[`mode-${mode.kind}`, flash ? `flash-${flash}` : null]"
    aria-live="polite"
  >
    <div class="hud-row">
      <span class="hud-mode">
        <span class="hud-dot"></span>
        {{ label }}
      </span>

      <span class="hud-trail" aria-label="keys pressed">
        <template v-if="trail.length === 0">
          <span class="hud-trail-empty">no keys yet</span>
        </template>
        <template v-else>
          <kbd
            v-for="(key, index) in trail"
            :key="index"
            :class="{ prefix: key === tool.prefix, last: index === trail.length - 1 }"
            >{{ key }}</kbd
          >
        </template>
        <span v-if="mode.kind === 'prefix'" class="hud-cursor">▮</span>
      </span>

      <span class="hud-stats">
        <span v-if="input === 'keyboard' || input === 'drill'" class="hud-stat">
          <span class="hud-stat-label">keys</span>
          {{ keystrokes }}<span v-if="par !== undefined" class="hud-par"> / {{ par }}</span>
        </span>
        <span class="hud-stat">
          <span class="hud-stat-label">time</span>
          {{ elapsed.toFixed(1) }}s
        </span>
        <button class="hud-help" type="button" @click="openHelp">
          <kbd>?</kbd> all {{ tool.label }} keys
        </button>
      </span>
    </div>
    <div v-if="$slots.guide" class="hud-foot hud-guide">
      <slot name="guide" />
    </div>
    <div v-if="$slots.default" class="hud-foot">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.hud {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--line2);
  background: var(--panel);
  padding: 8px 12px;
  transition: border-color 120ms ease;
}
.hud-foot {
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
.hud.mode-prefix {
  border-color: var(--yellow);
}
.hud.mode-copy,
.hud.mode-resize,
.hud.mode-workspace-picker,
.hud.mode-help,
.hud.mode-goto,
.hud.mode-rename {
  border-color: var(--teal);
}
.hud.flash-bad {
  animation: shake 320ms ease;
  border-color: var(--red);
}
.hud.flash-good {
  border-color: var(--green);
}
@keyframes shake {
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}

.hud-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.hud-mode {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  min-width: 150px;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
}
.hud-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--faint2);
}
.mode-prefix .hud-mode {
  color: var(--yellow);
}
.mode-prefix .hud-dot {
  background: var(--yellow);
  animation: pulse 900ms ease-in-out infinite;
}
.mode-copy .hud-mode,
.mode-resize .hud-mode,
.mode-workspace-picker .hud-mode,
.mode-help .hud-mode,
.mode-goto .hud-mode,
.mode-rename .hud-mode {
  color: var(--teal);
}
.mode-copy .hud-dot,
.mode-resize .hud-dot,
.mode-workspace-picker .hud-dot,
.mode-help .hud-dot,
.mode-goto .hud-dot,
.mode-rename .hud-dot {
  background: var(--teal);
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.hud-trail {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
}
.hud-trail kbd {
  opacity: 0.55;
}
.hud-trail kbd.last {
  opacity: 1;
}
.hud-trail kbd.prefix {
  border-color: var(--yellow);
  color: var(--yellow);
}
.hud-trail-empty {
  color: var(--faint2);
  font-size: 11px;
}
.hud-cursor {
  color: var(--yellow);
  animation: blink 1.1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}

.hud-stats {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.hud-stat-label {
  margin-right: 5px;
  color: var(--faint2);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.hud-par {
  color: var(--faint2);
  font-size: 11px;
}
.hud-help {
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--faint);
  font: inherit;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
}
.hud-help kbd {
  margin-right: 4px;
  font-size: 10px;
  padding: 0 5px;
}
.hud-help:hover,
.hud-help:focus-visible {
  color: var(--ink);
  border-color: var(--faint);
  outline: none;
}

@media (max-width: 900px) {
  .hud-row {
    flex-wrap: wrap;
  }
}
</style>
