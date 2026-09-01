<script setup lang="ts">
import type { PaneNode } from "../engine/multiplexer"
import TerminalPane from "./TerminalPane.vue"

defineOptions({ name: "PaneTree" })

defineProps<{
  node: PaneNode
  activePaneId: number
  focusPane: (id: number) => void
  runShellCommand: (command: string) => void
}>()
</script>

<template>
  <TerminalPane
    v-if="node.kind === 'leaf'"
    :key="node.id"
    :pane-id="node.id"
    :lines="node.lines"
    :variant="node.variant"
    :active="node.id === activePaneId"
    :focus-pane="focusPane"
    :run-shell-command="runShellCommand"
  />
  <div v-else class="split" :class="node.dir">
    <PaneTree
      :node="node.children[0]"
      :active-pane-id="activePaneId"
      :focus-pane="focusPane"
      :run-shell-command="runShellCommand"
    />
    <PaneTree
      :node="node.children[1]"
      :active-pane-id="activePaneId"
      :focus-pane="focusPane"
      :run-shell-command="runShellCommand"
    />
  </div>
</template>

<style scoped>
.split {
  display: flex;
  flex: 1;
  gap: 3px;
  min-width: 0;
  min-height: 0;
}
.split.row {
  flex-direction: row;
}
.split.column {
  flex-direction: column;
}
</style>
