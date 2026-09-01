<script setup lang="ts">
import { computed } from "vue"
import { leaves, type Keymap, type TrainerState } from "../engine/multiplexer"

const props = defineProps<{
  state: TrainerState
  keymap: Keymap
  sessionName: string
}>()

interface Level {
  term: string
  value: string
  flags: string[]
}

const levels = computed<Level[]>(() => {
  const state = props.state
  const panes = leaves(state.root)
  const paneIndex = panes.findIndex((pane) => pane.id === state.activePaneId)
  const paneFlags: string[] = []
  if (state.zoomedPaneId !== null) paneFlags.push("zoomed")

  const session: Level = {
    term: "session",
    value: props.sessionName,
    flags: state.detached ? ["detached"] : [],
  }

  const windowLevel: Level = {
    term: props.keymap === "tmux" ? "window" : "tab",
    value: `${state.activeTab + 1} of ${state.tabs}`,
    flags: [],
  }

  const pane: Level = {
    term: "pane",
    value: `${paneIndex + 1} of ${panes.length}`,
    flags: paneFlags,
  }

  if (props.keymap === "tmux") return [session, windowLevel, pane]

  const workspace: Level = {
    term: "workspace",
    value: state.workspaces[state.activeWorkspace] ?? "project",
    flags: [],
  }
  return [session, workspace, windowLevel, pane]
})
</script>

<template>
  <nav class="map" aria-label="where you are">
    <template v-for="(level, index) in levels" :key="level.term">
      <span v-if="index > 0" class="map-arrow" aria-hidden="true">›</span>
      <span class="map-level" :class="{ detached: level.flags.includes('detached') }">
        <span class="map-term">{{ level.term }}</span>
        <span class="map-value">{{ level.value }}</span>
        <span v-for="flag in level.flags" :key="flag" class="map-flag">{{ flag }}</span>
      </span>
    </template>
  </nav>
</template>

<style scoped>
.map {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  overflow-x: auto;
  font-size: 12px;
  white-space: nowrap;
}
.map-arrow {
  color: var(--faint2);
}
.map-level {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.map-term {
  color: var(--faint2);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.map-value {
  color: var(--ink);
}
.map-level.detached .map-value {
  color: var(--yellow);
}
.map-flag {
  padding: 0 5px;
  color: var(--spot-ink);
  background: var(--yellow);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
