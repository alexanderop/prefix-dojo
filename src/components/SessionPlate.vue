<script setup lang="ts">
import type { Tool, TrainerState } from "../engine/multiplexer"
import TerminalScreen from "./TerminalScreen.vue"

defineProps<{
  tool: Tool
  state: TrainerState
  /** Hides mode overlays once a result is showing. */
  done: boolean
  /** Restarts the pane shells when it changes. */
  layoutKey: string
  focusPane: (id: number) => void
  focusTab: (index: number) => void
  focusWorkspace: (index: number) => void
  runShellCommand: (command: string) => string[] | null
}>()
</script>

<template>
  <div class="plate">
    <div class="plate-body">
      <TerminalScreen
        :tool="tool"
        :state="state"
        :done="done"
        :layout-key="layoutKey"
        :focus-pane="focusPane"
        :focus-tab="focusTab"
        :focus-workspace="focusWorkspace"
        :run-shell-command="runShellCommand"
      />

      <slot />
    </div>
  </div>
</template>

<style scoped>
.plate {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line2);
  background: var(--term-bg);
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.4;
}
.plate-body {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
}
@media (max-width: 560px) {
  .plate-body {
    min-height: 360px;
  }
}
</style>
