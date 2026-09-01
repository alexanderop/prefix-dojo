<script setup lang="ts">
import type { PaneNode } from "../engine/multiplexer"
import TerminalPane from "./TerminalPane.vue"

defineOptions({ name: "PaneTree" })

/**
 * Pane title for the border: the first word of the first line, without ANSI
 * colour. Herdr names a pane after its process; the agent state stays in the
 * sidebar and the pane's own output.
 */
function titleOf(lines: string[]): string {
  const first = (lines[0] ?? "").replace(/\x1b\[[0-9;]*m/g, "").replace(/^#\s*/, "").trim()
  const agent = /^(\S+)\s+●/.exec(first)
  return agent ? agent[1] : first
}

defineProps<{
  node: PaneNode
  activePaneId: number
  /** Herdr draws no pane chrome when a tab holds a single pane. */
  single?: boolean
  focusPane: (id: number) => void
  runShellCommand: (command: string) => void
}>()
</script>

<template>
  <TerminalPane
    v-if="node.kind === 'leaf'"
    :key="`${node.id}-${node.variant}`"
    :pane-id="node.id"
    :lines="node.lines"
    :title="titleOf(node.lines)"
    :variant="node.variant"
    :active="node.id === activePaneId"
    :single="single === true"
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
  gap: 0;
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
