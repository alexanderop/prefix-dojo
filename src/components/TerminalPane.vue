<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Terminal, type IDisposable } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import type { PaneVariant } from "../engine/multiplexer"
import { startShell } from "../shell/fakeShell"

const props = defineProps<{
  paneId: number
  lines: string[]
  title: string
  variant: PaneVariant
  active: boolean
  single: boolean
  focusPane: (id: number) => void
  runShellCommand: (command: string) => void
}>()

const host = ref<HTMLDivElement | null>(null)

/** Herdr colours a pane by its agent state; mirror that on the frame. */
const agentState = computed(() => {
  const first = (props.lines[0] ?? "").replace(/\x1b\[[0-9;]*m/g, "")
  const match = /●\s*(blocked|working|done|idle)/.exec(first)
  return match?.[1] ?? null
})
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
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    fontSize: 12.5,
    lineHeight: 1.4,
    theme: {
      background: "#11111b",
      foreground: "#cdd6f4",
      cursor: "#cba6f7",
      cursorAccent: "#11111b",
      selectionBackground: "rgba(203, 166, 247, 0.3)",
      black: "#11111b",
      red: "#f38ba8",
      green: "#a6e3a1",
      yellow: "#f9e2af",
      blue: "#89b4fa",
      magenta: "#cba6f7",
      cyan: "#94e2d5",
      white: "#cdd6f4",
      brightBlack: "#6c7086",
      brightRed: "#f38ba8",
      brightGreen: "#a6e3a1",
      brightYellow: "#f9e2af",
      brightBlue: "#89b4fa",
      brightMagenta: "#cba6f7",
      brightCyan: "#94e2d5",
      brightWhite: "#cdd6f4",
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
  <div class="pane" :class="{ active, single, [`state-${agentState}`]: agentState !== null }" @mousedown="focusPane(paneId)">
    <!-- Border runs through the middle of the edge cell, like a box-drawing glyph. -->
    <span class="pane-frame" aria-hidden="true"></span>
    <span v-if="!single" class="pane-title">{{ title || `pane ${paneId}` }}</span>
    <div ref="host" class="pane-term"></div>
  </div>
</template>

<style scoped>
.pane {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--term-bg);
  padding: 0.9em 1ch;
}
.pane.single {
  padding: 0.5em 1ch;
}
.pane-frame {
  position: absolute;
  inset: 0.45em 0.5ch;
  border: 1px solid var(--term-border);
  pointer-events: none;
  transition: border-color 120ms ease;
}
.pane.active .pane-frame {
  border-color: var(--spot);
}
.pane.single .pane-frame {
  display: none;
}
/* Title embedded in the top border, one cell in from the left. */
.pane-title {
  position: absolute;
  top: 0.45em;
  left: 2ch;
  z-index: 1;
  max-width: calc(100% - 4ch);
  transform: translateY(-50%);
  padding: 0 0.6ch;
  background: var(--term-bg);
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
.pane.active .pane-title {
  color: var(--spot);
  font-weight: 700;
}
.pane.state-blocked:not(.active) .pane-title {
  color: var(--red);
}
.pane.state-blocked:not(.active) .pane-frame {
  border-color: rgba(243, 139, 168, 0.6);
}
.pane-term {
  flex: 1;
  min-height: 0;
  padding: 0.2em 0.8ch 0.2em 1.2ch;
}
</style>
