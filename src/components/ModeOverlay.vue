<script setup lang="ts">
import { computed } from "vue"
import type { Tool, TrainerMode } from "../engine/multiplexer"

const props = defineProps<{
  mode: TrainerMode
  tool: Tool
  workspaces: string[]
}>()

const copyHint = computed(() => {
  const { select, copy, search } = props.tool.copy
  if (props.mode.kind === "copy" && props.mode.search !== null) {
    return `n next · N previous · ${select} select · q exit`
  }
  return `${search ? "/ search · " : ""}${select} select · ${copy} copy · q exit`
})

const copyStatus = computed(() => {
  if (props.mode.kind !== "copy") return ""
  if (props.mode.selecting) return "selection started"
  const search = props.mode.search
  if (search === null) return "move through pane history"
  return `${search.matches} match${search.matches === 1 ? "" : "es"} for "${search.query}"`
})
</script>

<template>
  <div v-if="mode.kind === 'workspace-picker'" class="mode-overlay picker-overlay">
    <p class="overlay-title">workspace navigation</p>
    <p
      v-for="(workspace, index) in workspaces"
      :key="workspace"
      :class="{ selected: index === mode.selected }"
    >
      {{ index === mode.selected ? "▸" : " " }} {{ workspace }}
    </p>
    <small>↑/↓ select · enter open · esc close</small>
  </div>

  <div v-else-if="mode.kind === 'resize'" class="mode-overlay compact-overlay">
    <p class="overlay-title">resize mode</p>
    <p>h j k l or arrow keys</p>
    <small>enter or esc exits</small>
  </div>

  <div v-else-if="mode.kind === 'copy' && mode.search?.typing" class="mode-overlay compact-overlay">
    <p class="overlay-title">search {{ mode.search.direction }}</p>
    <p class="overlay-input">
      {{ mode.search.direction === "forward" ? "/" : "?" }}{{ mode.search.query
      }}<span class="overlay-caret">▮</span>
    </p>
    <small>enter search · esc cancel</small>
  </div>

  <div v-else-if="mode.kind === 'copy'" class="mode-overlay compact-overlay">
    <p class="overlay-title">copy mode</p>
    <p>{{ copyStatus }}</p>
    <small>{{ copyHint }}</small>
  </div>

  <div v-else-if="mode.kind === 'rename'" class="mode-overlay compact-overlay">
    <p class="overlay-title">rename {{ mode.target }}</p>
    <p class="overlay-input">{{ mode.value }}<span class="overlay-caret">▮</span></p>
    <small>enter save · esc cancel</small>
  </div>

  <div v-else-if="mode.kind === 'goto'" class="mode-overlay picker-overlay">
    <p class="overlay-title">go to</p>
    <p class="selected">▸ workspace / tab / pane</p>
    <p>agent by state</p>
    <small>type to filter · esc close</small>
  </div>
</template>

<style scoped>
.mode-overlay {
  position: absolute;
  z-index: 2;
  top: 18px;
  left: 50%;
  min-width: 280px;
  transform: translateX(-50%);
  border: 1px solid var(--spot);
  background: var(--term-active);
  padding: 12px 16px;
  color: var(--fg);
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.55);
}
.mode-overlay p {
  margin: 2px 0;
}
.overlay-title {
  margin-bottom: 8px !important;
  color: var(--spot);
  font-weight: 800;
}
.mode-overlay .selected {
  color: var(--spot);
  background: rgba(203, 166, 247, 0.1);
}
.mode-overlay small {
  display: block;
  margin-top: 10px;
  color: var(--muted);
}
.compact-overlay {
  top: auto;
  right: 18px;
  bottom: 18px;
  left: auto;
  min-width: 240px;
  transform: none;
}
/* text entry inside an overlay (rename, copy-mode search) */
.overlay-input {
  font-family: inherit;
  min-height: 1.4em;
  padding: 4px 8px;
  border: 1px solid var(--faint2);
  background: var(--term-bg);
  color: var(--fg);
  white-space: pre;
}
.overlay-caret {
  color: var(--spot);
  animation: caret-blink 900ms ease-in-out infinite;
}
@keyframes caret-blink {
  50% {
    opacity: 0.2;
  }
}
</style>
