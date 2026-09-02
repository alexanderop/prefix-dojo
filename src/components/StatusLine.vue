<script setup lang="ts">
import type { Tool, TrainerState } from "../engine/multiplexer"
import type { TabItem } from "./TabBar.vue"

defineProps<{
  tool: Tool
  state: TrainerState
  tabs: Array<TabItem & { label: string }>
  /** Right-hand caption, e.g. "tmux · keyboard". */
  caption: string
}>()
</script>

<template>
  <footer class="statusline" :class="{ armed: state.mode.kind === 'prefix' }">
    <span class="statusline-session">[{{ tool.sessionName }}]</span>
    <span v-if="tool.hasWorkspaces" class="statusline-windows">
      <span class="statusline-window current">{{ state.workspaces[state.activeWorkspace] }}</span>
      <span class="statusline-window">tab {{ state.activeTab + 1 }}/{{ state.tabs }}</span>
    </span>
    <span v-else class="statusline-windows">
      <span
        v-for="item in tabs"
        :key="item.index"
        class="statusline-window"
        :class="{ current: item.current }"
        >{{ item.label }}</span
      >
    </span>
    <span class="statusline-action">{{ state.lastAction ?? "waiting for input…" }}</span>
    <span>{{ caption }}</span>
  </footer>
</template>

<style scoped>
/* tmux's bar, in the plate's palette */
.statusline {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11.5px;
  color: var(--dim);
  background: var(--term-active);
  border-top: 1px solid var(--term-border);
  padding: 4px 12px;
  transition: background 120ms ease;
}
.statusline-session {
  padding: 0 6px;
  color: var(--spot-ink);
  background: var(--spot);
  font-weight: 700;
}
.statusline.armed {
  background: var(--spot);
  color: var(--spot-ink);
}
.statusline.armed .statusline-session {
  background: var(--spot-ink);
  color: var(--spot);
}
.statusline-windows {
  display: flex;
  gap: 10px;
}
.statusline-window {
  opacity: 0.6;
}
.statusline-window.current {
  opacity: 1;
  color: var(--fg);
  font-weight: 700;
}
.statusline.armed .statusline-window.current {
  color: inherit;
}
.statusline-action {
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .statusline-windows {
    display: none;
  }
}
</style>
