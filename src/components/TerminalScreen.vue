<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { Unicode11Addon } from "@xterm/addon-unicode11"
import { WebglAddon } from "@xterm/addon-webgl"
import "@xterm/xterm/css/xterm.css"
import { PALETTE } from "../engine/grid"
import type { Tool, TrainerState } from "../engine/multiplexer"
import { activeLeaf, leaves } from "../engine/multiplexer"
import { hitTest, renderScreen, type Frame, type ShellView } from "../engine/screen"
import { ShellSession } from "../shell/shellSession"

const props = defineProps<{
  tool: Tool
  state: TrainerState
  /** Input is frozen once a result is showing. */
  done: boolean
  /** Changes whenever the lesson layout is rebuilt; shells start over. */
  layoutKey: string
  focusPane: (id: number) => void
  focusTab: (index: number) => void
  focusWorkspace: (index: number) => void
  runShellCommand: (command: string) => string[] | null
}>()

const host = ref<HTMLDivElement | null>(null)

let term: Terminal | null = null
let fit: FitAddon | null = null
let observer: ResizeObserver | null = null
let clockTimer: number | undefined
let frameRequest: number | undefined
let lastFrame: Frame | null = null

// ---- shells ----

/** One shell per shell pane, kept while the lesson attempt lasts. */
let shells = new Map<number, ShellSession>()
/** The client's own shell, shown while detached. */
let outer: ShellSession | null = null

function commandWords(): string[] {
  return [props.tool.id, ...(props.tool.id === "tmux" ? ["tmux"] : ["herdr"])]
}

function shellFor(paneId: number): ShellSession | undefined {
  const pane = leaves(props.state.root).find((leaf) => leaf.id === paneId)
  if (pane === undefined || pane.variant !== "shell") return undefined
  let shell = shells.get(paneId)
  if (shell === undefined) {
    // A session started from the outer shell opens with a fresh shell; the
    // pane's lines were already shown outside.
    const lines = startedOutside() ? [] : pane.lines
    shell = new ShellSession({ lines, commands: commandWords() })
    shells.set(paneId, shell)
  }
  return shell
}

function outerShell(): ShellSession {
  if (outer === null) {
    const { state, tool } = props
    const pane = activeLeaf(state)
    const lines = state.serverStopped
      ? [`${tool.label.toLowerCase()}: server stopped`]
      : startedOutside()
        ? (pane?.lines ?? [])
        : [`[detached (from session ${tool.sessionName})]`]
    outer = new ShellSession({ lines, commands: commandWords() })
  }
  return outer
}

/** A lesson that starts before the tool is running shows the pane's own lines. */
let startedOutside = (): boolean => false

function resetShells(): void {
  shells = new Map()
  outer = null
  const outside = props.state.detached
  startedOutside = () => outside
}

function viewOf(shell: ShellSession): ShellView {
  return { lines: shell.lines, prompt: shell.prompt, input: shell.input, cursor: shell.cursor }
}

function outsideSession(): boolean {
  return props.state.detached || props.state.serverStopped
}

/** The shell that receives typed input right now, if any. */
function inputShell(): ShellSession | undefined {
  if (props.done) return undefined
  if (outsideSession()) return outerShell()
  if (props.state.mode.kind !== "terminal") return undefined
  return shellFor(props.state.activePaneId)
}

// ---- rendering ----

function clock(): string {
  const now = new Date()
  const month = now.toLocaleString("en-US", { month: "short" })
  const pad = (n: number): string => String(n).padStart(2, "0")
  return `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}-${month}-${String(now.getFullYear()).slice(-2)}`
}

function paint(): void {
  if (term === null) return
  const frame = renderScreen({
    state: props.state,
    tool: props.tool,
    cols: term.cols,
    rows: term.rows,
    shellView: (id) => {
      const shell = shellFor(id)
      return shell === undefined ? undefined : viewOf(shell)
    },
    outerShell: outsideSession() ? viewOf(outerShell()) : null,
    clock: clock(),
  })
  lastFrame = frame

  // DEC 2026 brackets the redraw so xterm presents it as one frame.
  let out = "\x1b[?2026h\x1b[?25l"
  frame.rows.forEach((row, y) => {
    out += `\x1b[${y + 1};1H${row}`
  })
  if (frame.cursor !== null && !props.done) {
    out += `\x1b[${frame.cursor.y + 1};${frame.cursor.x + 1}H\x1b[?25h`
  }
  out += "\x1b[?2026l"
  term.write(out)
}

function schedule(): void {
  if (frameRequest !== undefined) return
  frameRequest = requestAnimationFrame(() => {
    frameRequest = undefined
    paint()
  })
}

// ---- input ----

// eslint-disable-next-line no-control-regex -- SGR mouse reports start with an escape
const MOUSE = /^\x1b\[<(\d+);(\d+);(\d+)([mM])$/

function onData(data: string): void {
  const mouse = MOUSE.exec(data)
  if (mouse !== null)
    return onMouse(Number(mouse[1]), Number(mouse[2]) - 1, Number(mouse[3]) - 1, mouse[4])

  const shell = inputShell()
  if (shell === undefined) return
  shell.feed(data, props.runShellCommand)
  schedule()
}

function onMouse(button: number, x: number, y: number, action: string): void {
  // Left button press only; releases, drags, and wheel reports are ignored.
  if (action !== "M" || button !== 0 || lastFrame === null || props.done) return
  const target = hitTest(lastFrame.regions, x, y)
  if (target === null) return
  if (target.kind === "pane") props.focusPane(target.id)
  else if (target.kind === "tab") props.focusTab(target.index)
  else props.focusWorkspace(target.index)
}

function focusTerminal(): void {
  term?.focus()
}

// ---- lifecycle ----

onMounted(async () => {
  if (host.value === null) return
  term = new Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    cursorStyle: "block",
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    fontSize: 13,
    lineHeight: 1.25,
    scrollback: 0,
    theme: {
      background: PALETTE.bg,
      foreground: PALETTE.fg,
      cursor: PALETTE.spot,
      cursorAccent: PALETTE.bg,
      selectionBackground: "rgba(203, 166, 247, 0.3)",
      black: PALETTE.black,
      red: PALETTE.red,
      green: PALETTE.green,
      yellow: PALETTE.yellow,
      blue: PALETTE.blue,
      magenta: PALETTE.spot,
      cyan: PALETTE.cyan,
      white: PALETTE.fg,
      brightBlack: PALETTE.muted,
      brightRed: PALETTE.red,
      brightGreen: PALETTE.green,
      brightYellow: PALETTE.yellow,
      brightBlue: PALETTE.blue,
      brightMagenta: PALETTE.spot,
      brightCyan: PALETTE.cyan,
      brightWhite: PALETTE.fg,
    },
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new Unicode11Addon())
  term.unicode.activeVersion = "11"

  // Measure with the web font, or every cell is the fallback font's width.
  try {
    await document.fonts.load('13px "JetBrains Mono"')
  } catch {
    // Fallback font; layout still works.
  }
  if (host.value === null || term === null) return
  term.open(host.value)
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
  } catch {
    // The DOM renderer is fine; the WebGL one is only crisper.
  }
  fit.fit()
  // SGR mouse reporting, the mode tmux and Herdr turn on for click-to-focus.
  term.write("\x1b[?1000h\x1b[?1006h")
  term.onData(onData)
  term.onResize(() => schedule())
  resetShells()
  paint()
  focusTerminal()

  observer = new ResizeObserver(() => fit?.fit())
  observer.observe(host.value)
  clockTimer = window.setInterval(schedule, 30_000)
})

watch(
  () => props.layoutKey,
  () => {
    resetShells()
    schedule()
  },
)
watch(() => [props.state, props.done, props.tool], schedule)
watch(
  () => props.done,
  (done) => {
    if (!done) focusTerminal()
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  window.clearInterval(clockTimer)
  if (frameRequest !== undefined) cancelAnimationFrame(frameRequest)
  term?.dispose()
})

defineExpose({ focus: focusTerminal })
</script>

<template>
  <div ref="host" class="screen" @mousedown="focusTerminal"></div>
</template>

<style scoped>
.screen {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 6px 8px 4px;
  background: var(--term-bg);
}
.screen :deep(.xterm) {
  height: 100%;
}
.screen :deep(.xterm-viewport) {
  overflow: hidden !important;
  background: var(--term-bg) !important;
}
</style>
