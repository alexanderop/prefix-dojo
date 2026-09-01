<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Terminal, type IDisposable } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import type { PaneVariant } from "../engine/multiplexer"
import { startShell } from "../shell/fakeShell"

const props = defineProps<{
  paneId: number
  lines: string[]
  variant: PaneVariant
  active: boolean
  focusPane: (id: number) => void
  runShellCommand: (command: string) => void
}>()

const host = ref<HTMLDivElement | null>(null)
let term: Terminal | null = null
let fit: FitAddon | null = null
let observer: ResizeObserver | null = null
let shellInput: IDisposable | null = null
let alive = true

onMounted(() => {
  if (!host.value) return
  term = new Terminal({
    disableStdin: props.variant === "static",
    cursorBlink: props.active,
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: 13,
    lineHeight: 1.25,
    theme: {
      background: "#0b100b",
      foreground: "#b8ccb8",
      cursor: "#4af07a",
      black: "#0b100b",
      green: "#4af07a",
      yellow: "#ffb454",
      red: "#ff5f56",
      cyan: "#6ad7e5",
      brightBlack: "#5a6b5a",
    },
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.open(host.value)
  fit.fit()
  if (props.lines.length > 0) term.write(props.lines.join("\r\n") + "\r\n")
  if (props.variant === "shell") {
    shellInput = startShell(term, () => alive, props.runShellCommand)
    if (props.active) term.focus()
  }
  observer = new ResizeObserver(() => fit?.fit())
  observer.observe(host.value)
})

watch(
  () => props.active,
  (active) => {
    if (!term) return
    term.options.cursorBlink = active
    if (active && props.variant === "shell") term.focus()
  },
)

onBeforeUnmount(() => {
  alive = false
  observer?.disconnect()
  shellInput?.dispose()
  term?.dispose()
})
</script>

<template>
  <div class="pane" :class="{ active }" @mousedown="focusPane(paneId)">
    <div class="pane-chrome">
      <span class="pane-index">{{ paneId }}</span>
      <span v-if="active" class="pane-focus">FOCUSED</span>
    </div>
    <div ref="host" class="pane-term"></div>
  </div>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--line);
  background: #0b100b;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.pane.active {
  border-color: var(--green);
  box-shadow: 0 0 14px rgba(74, 240, 122, 0.18), inset 0 0 24px rgba(74, 240, 122, 0.04);
}
.pane-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--dim);
  border-bottom: 1px solid var(--line);
  user-select: none;
}
.pane.active .pane-chrome {
  color: var(--green);
  border-bottom-color: rgba(74, 240, 122, 0.35);
}
.pane-term {
  flex: 1;
  min-height: 0;
  padding: 6px 4px 4px 8px;
}
</style>
