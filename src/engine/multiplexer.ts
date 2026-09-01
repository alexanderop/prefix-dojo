/**
 * Pure state machine for the practice terminal. The model mirrors the parts
 * of tmux and Herdr that the lessons exercise; the browser only renders it.
 */

export type SplitDir = "row" | "column"
export type PaneVariant = "shell" | "static"

export type PaneNode =
  | { kind: "leaf"; id: number; lines: string[]; variant: PaneVariant }
  | { kind: "split"; dir: SplitDir; children: [PaneNode, PaneNode] }

export type TrainerMode =
  | { kind: "terminal" }
  | { kind: "prefix" }
  | { kind: "copy"; selecting: boolean }
  | { kind: "resize" }
  | { kind: "workspace-picker"; selected: number }
  | { kind: "help" }
  | { kind: "goto" }

export type TrainerAction =
  | "started-tmux"
  | "started-herdr"
  | "opened-help"
  | "split-right"
  | "split-down"
  | "focused-pane"
  | "closed-pane"
  | "zoomed-pane"
  | "opened-tab"
  | "switched-tab"
  | "entered-copy-mode"
  | "copied-selection"
  | "detached"
  | "created-workspace"
  | "switched-workspace"
  | "resized-pane"
  | "toggled-sidebar"
  | "created-worktree"
  | "remote-attached"
  | "installed-integration"
  | "automated-pane"
  | "listed-plugins"

export interface TrainerState {
  root: PaneNode
  activePaneId: number
  mode: TrainerMode
  keystrokes: number
  tabs: number
  activeTab: number
  workspaces: string[]
  activeWorkspace: number
  nextPaneId: number
  detached: boolean
  zoomedPaneId: number | null
  sidebarVisible: boolean
  actions: TrainerAction[]
  lastAction: string | null
}

export type Keymap = "tmux" | "herdr"

export interface KeyInput {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface InitialStateInput {
  root: PaneNode
  activePaneId: number
  tabs?: number
  activeTab?: number
  workspaces?: string[]
  activeWorkspace?: number
}

const NEW_PANE_LINES = ["\x1b[90m# fresh pane. run a shell, server, or agent here\x1b[0m"]

export function leaf(
  id: number,
  lines: string[] = [],
  variant: PaneVariant = "static",
): Extract<PaneNode, { kind: "leaf" }> {
  return { kind: "leaf", id, lines, variant }
}

export function initialState(input: InitialStateInput): TrainerState {
  const workspaces = input.workspaces ?? ["project"]
  return {
    root: input.root,
    activePaneId: input.activePaneId,
    mode: { kind: "terminal" },
    keystrokes: 0,
    tabs: input.tabs ?? 1,
    activeTab: input.activeTab ?? 0,
    workspaces,
    activeWorkspace: input.activeWorkspace ?? 0,
    nextPaneId: maxPaneId(input.root) + 1,
    detached: false,
    zoomedPaneId: null,
    sidebarVisible: true,
    actions: [],
    lastAction: null,
  }
}

export function leaves(node: PaneNode): Extract<PaneNode, { kind: "leaf" }>[] {
  if (node.kind === "leaf") return [node]
  return [...leaves(node.children[0]), ...leaves(node.children[1])]
}

export function did(state: TrainerState, action: TrainerAction): boolean {
  return state.actions.includes(action)
}

function maxPaneId(node: PaneNode): number {
  return Math.max(...leaves(node).map((pane) => pane.id))
}

function record(state: TrainerState, action: TrainerAction): void {
  if (!state.actions.includes(action)) state.actions.push(action)
}

/** Normalized 0..1 rectangles per pane, used for spatial navigation. */
export function paneRects(
  node: PaneNode,
  rect: Rect = { x: 0, y: 0, w: 1, h: 1 },
  out: Map<number, Rect> = new Map(),
): Map<number, Rect> {
  if (node.kind === "leaf") {
    out.set(node.id, rect)
    return out
  }
  const [first, second] = node.children
  if (node.dir === "row") {
    const half = rect.w / 2
    paneRects(first, { x: rect.x, y: rect.y, w: half, h: rect.h }, out)
    paneRects(second, { x: rect.x + half, y: rect.y, w: half, h: rect.h }, out)
  } else {
    const half = rect.h / 2
    paneRects(first, { x: rect.x, y: rect.y, w: rect.w, h: half }, out)
    paneRects(second, { x: rect.x, y: rect.y + half, w: rect.w, h: half }, out)
  }
  return out
}

type Direction = "left" | "right" | "up" | "down"

function navigate(state: TrainerState, direction: Direction): void {
  const rects = paneRects(state.root)
  const from = rects.get(state.activePaneId)
  if (from === undefined) return

  const fromX = from.x + from.w / 2
  const fromY = from.y + from.h / 2
  let best: { id: number; distance: number } | null = null

  for (const [id, rect] of rects) {
    if (id === state.activePaneId) continue
    const x = rect.x + rect.w / 2
    const y = rect.y + rect.h / 2
    const isInDirection =
      (direction === "left" && x < fromX) ||
      (direction === "right" && x > fromX) ||
      (direction === "up" && y < fromY) ||
      (direction === "down" && y > fromY)
    if (!isInDirection) continue

    const distance = (x - fromX) ** 2 + (y - fromY) ** 2
    if (best === null || distance < best.distance) best = { id, distance }
  }

  if (best === null) {
    state.lastAction = `no pane to the ${direction}`
    return
  }

  state.activePaneId = best.id
  state.zoomedPaneId = null
  state.lastAction = `focused pane ${best.id}`
  record(state, "focused-pane")
}

function replaceNode(node: PaneNode, targetId: number, replacement: PaneNode): PaneNode {
  if (node.kind === "leaf") return node.id === targetId ? replacement : node
  return {
    kind: "split",
    dir: node.dir,
    children: [
      replaceNode(node.children[0], targetId, replacement),
      replaceNode(node.children[1], targetId, replacement),
    ],
  }
}

function splitActive(state: TrainerState, direction: SplitDir): void {
  const active = leaves(state.root).find((pane) => pane.id === state.activePaneId)
  if (active === undefined) return

  const newPane = leaf(state.nextPaneId, [...NEW_PANE_LINES], "shell")
  state.root = replaceNode(state.root, active.id, {
    kind: "split",
    dir: direction,
    children: [active, newPane],
  })
  state.activePaneId = newPane.id
  state.nextPaneId += 1
  state.zoomedPaneId = null

  if (direction === "row") {
    state.lastAction = "split pane to the right"
    record(state, "split-right")
  } else {
    state.lastAction = "split pane below"
    record(state, "split-down")
  }
}

function removeLeaf(node: PaneNode, targetId: number): PaneNode | null {
  if (node.kind === "leaf") return node.id === targetId ? null : node
  const first = removeLeaf(node.children[0], targetId)
  const second = removeLeaf(node.children[1], targetId)
  if (first === null) return second
  if (second === null) return first
  return { kind: "split", dir: node.dir, children: [first, second] }
}

function closeActivePane(state: TrainerState): void {
  if (state.root.kind === "leaf") {
    state.lastAction = "cannot close the last pane"
    return
  }
  const remaining = removeLeaf(state.root, state.activePaneId)
  if (remaining === null) return
  state.root = remaining
  state.activePaneId = leaves(remaining)[0].id
  state.zoomedPaneId = null
  state.lastAction = "closed pane"
  record(state, "closed-pane")
}

function toggleZoom(state: TrainerState): void {
  if (state.zoomedPaneId === null) {
    state.zoomedPaneId = state.activePaneId
    state.lastAction = `zoomed pane ${state.activePaneId}`
    record(state, "zoomed-pane")
  } else {
    state.zoomedPaneId = null
    state.lastAction = "restored pane layout"
  }
}

function newTab(state: TrainerState): void {
  state.tabs += 1
  state.activeTab = state.tabs - 1
  state.lastAction = `created tab ${state.activeTab + 1}`
  record(state, "opened-tab")
}

function cycleTab(state: TrainerState, step: 1 | -1): void {
  state.activeTab = (state.activeTab + step + state.tabs) % state.tabs
  state.lastAction = step === 1 ? "selected next tab" : "selected previous tab"
  record(state, "switched-tab")
}

function switchTab(state: TrainerState, key: string): boolean {
  const index = Number(key) - 1
  if (!Number.isInteger(index) || index < 0 || index >= state.tabs) return false
  state.activeTab = index
  state.lastAction = `selected tab ${index + 1}`
  record(state, "switched-tab")
  return true
}

function enterCopyMode(state: TrainerState): void {
  state.mode = { kind: "copy", selecting: false }
  state.lastAction = "entered copy mode"
  record(state, "entered-copy-mode")
}

function detach(state: TrainerState): void {
  state.detached = true
  state.mode = { kind: "terminal" }
  state.lastAction = "detached; processes keep running"
  record(state, "detached")
}

function openHelp(state: TrainerState): void {
  state.mode = { kind: "help" }
  state.lastAction = "opened active keybindings"
  record(state, "opened-help")
}

function runTmuxCommand(state: TrainerState, input: KeyInput): void {
  if (switchTab(state, input.key)) return

  switch (input.key) {
    case "?":
      return openHelp(state)
    case "%":
      return splitActive(state, "row")
    case '"':
      return splitActive(state, "column")
    case "ArrowLeft":
      return navigate(state, "left")
    case "ArrowRight":
      return navigate(state, "right")
    case "ArrowUp":
      return navigate(state, "up")
    case "ArrowDown":
      return navigate(state, "down")
    case "o": {
      const panes = leaves(state.root)
      const index = panes.findIndex((pane) => pane.id === state.activePaneId)
      state.activePaneId = panes[(index + 1) % panes.length].id
      state.lastAction = "cycled to the next pane"
      record(state, "focused-pane")
      return
    }
    case "x":
      return closeActivePane(state)
    case "z":
      return toggleZoom(state)
    case "c":
      return newTab(state)
    case "n":
      return cycleTab(state, 1)
    case "p":
      return cycleTab(state, -1)
    case "[":
      return enterCopyMode(state)
    case "d":
      return detach(state)
    default:
      state.lastAction = `tmux has no binding for prefix + ${input.key}`
  }
}

function runHerdrCommand(state: TrainerState, input: KeyInput): void {
  if (switchTab(state, input.key)) return

  if (input.shift && input.key.toLowerCase() === "n") {
    state.workspaces.push(`workspace-${state.workspaces.length + 1}`)
    state.activeWorkspace = state.workspaces.length - 1
    state.lastAction = `created ${state.workspaces[state.activeWorkspace]}`
    record(state, "created-workspace")
    return
  }

  if (input.shift && input.key.toLowerCase() === "g") {
    state.lastAction = "opened Git worktree creation"
    record(state, "created-worktree")
    return
  }

  switch (input.key) {
    case "?":
      return openHelp(state)
    case "v":
      return splitActive(state, "row")
    case "-":
      return splitActive(state, "column")
    case "h":
      return navigate(state, "left")
    case "j":
      return navigate(state, "down")
    case "k":
      return navigate(state, "up")
    case "l":
      return navigate(state, "right")
    case "x":
      return closeActivePane(state)
    case "z":
      return toggleZoom(state)
    case "c":
      return newTab(state)
    case "n":
      return cycleTab(state, 1)
    case "p":
      return cycleTab(state, -1)
    case "[":
      return enterCopyMode(state)
    case "r":
      state.mode = { kind: "resize" }
      state.lastAction = "entered resize mode"
      return
    case "w":
      state.mode = { kind: "workspace-picker", selected: state.activeWorkspace }
      state.lastAction = "opened workspace navigation"
      return
    case "g":
      state.mode = { kind: "goto" }
      state.lastAction = "opened session navigator"
      return
    case "b":
      state.sidebarVisible = !state.sidebarVisible
      state.lastAction = state.sidebarVisible ? "showed sidebar" : "hid sidebar"
      record(state, "toggled-sidebar")
      return
    case "q":
      return detach(state)
    default:
      state.lastAction = `Herdr has no binding for prefix + ${input.key}`
  }
}

function runCopyMode(state: TrainerState, input: KeyInput): void {
  if (input.key === "Escape" || input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "left copy mode"
    return
  }

  const selecting = state.mode.kind === "copy" && state.mode.selecting
  if (input.key === " " || input.key === "v") {
    state.mode = { kind: "copy", selecting: true }
    state.lastAction = "started selection"
    return
  }
  if ((input.key === "Enter" || input.key === "y") && selecting) {
    state.mode = { kind: "terminal" }
    state.lastAction = "copied selection"
    record(state, "copied-selection")
    return
  }
  state.lastAction = `moved through history with ${input.key}`
}

function runResizeMode(state: TrainerState, input: KeyInput): void {
  if (input.key === "Escape" || input.key === "Enter" || input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "left resize mode"
    return
  }
  if (["h", "j", "k", "l", "ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"].includes(input.key)) {
    state.lastAction = `resized pane with ${input.key}`
    record(state, "resized-pane")
    return
  }
  state.lastAction = "resize mode expects h, j, k, l, or an arrow key"
}

function runWorkspacePicker(state: TrainerState, input: KeyInput): void {
  if (input.key === "Escape" || input.key === "q") {
    state.mode = { kind: "terminal" }
    state.lastAction = "closed workspace navigation"
    return
  }

  if (input.key === "ArrowDown" || input.key === "j") {
    const selected = (state.mode.kind === "workspace-picker" ? state.mode.selected : 0) + 1
    state.mode = { kind: "workspace-picker", selected: selected % state.workspaces.length }
    state.lastAction = "selected next workspace"
    return
  }
  if (input.key === "ArrowUp" || input.key === "k") {
    const selected = state.mode.kind === "workspace-picker" ? state.mode.selected : 0
    state.mode = {
      kind: "workspace-picker",
      selected: (selected - 1 + state.workspaces.length) % state.workspaces.length,
    }
    state.lastAction = "selected previous workspace"
    return
  }
  if (input.key === "Enter" && state.mode.kind === "workspace-picker") {
    state.activeWorkspace = state.mode.selected
    state.mode = { kind: "terminal" }
    state.lastAction = `opened ${state.workspaces[state.activeWorkspace]}`
    record(state, "switched-workspace")
    return
  }
  state.lastAction = "use up or down, then enter"
}

export function applyKey(state: TrainerState, input: KeyInput, keymap: Keymap): TrainerState {
  const next = structuredClone(state)
  next.keystrokes += 1

  switch (next.mode.kind) {
    case "copy":
      runCopyMode(next, input)
      return next
    case "resize":
      runResizeMode(next, input)
      return next
    case "workspace-picker":
      runWorkspacePicker(next, input)
      return next
    case "help":
    case "goto":
      if (input.key === "Escape" || input.key === "q") {
        next.mode = { kind: "terminal" }
        next.lastAction = "closed overlay"
      }
      return next
    case "terminal":
      if (input.ctrl && input.key.toLowerCase() === "b") {
        next.mode = { kind: "prefix" }
        next.lastAction = "prefix armed"
      } else {
        next.lastAction = "sent key to the focused terminal"
      }
      return next
    case "prefix":
      if (input.ctrl && input.key.toLowerCase() === "b") {
        next.mode = { kind: "terminal" }
        next.lastAction = "sent a literal ctrl+b to the focused terminal"
        return next
      }
      next.mode = { kind: "terminal" }
      if (keymap === "tmux") runTmuxCommand(next, input)
      else runHerdrCommand(next, input)
      return next
  }
}

export function applyShellCommand(
  state: TrainerState,
  command: string,
  keymap: Keymap,
): TrainerState {
  const next = structuredClone(state)
  const normalized = command.trim().replace(/\s+/g, " ")

  if (keymap === "herdr" && normalized === "herdr --remote workbox") {
    next.lastAction = "attached to workbox through SSH"
    record(next, "remote-attached")
  } else if (keymap === "herdr" && normalized === "herdr integration install codex") {
    next.lastAction = "installed the Codex integration"
    record(next, "installed-integration")
  } else if (
    keymap === "herdr" &&
    normalized === "herdr pane split --current --direction right"
  ) {
    splitActive(next, "row")
    next.lastAction = "created a pane through the Herdr CLI"
    record(next, "automated-pane")
  } else if (keymap === "tmux" && normalized === "tmux attach -t work") {
    next.lastAction = "attached to tmux session work"
  } else if (keymap === "tmux" && normalized === "tmux new -s work") {
    next.lastAction = "created and attached to tmux session work"
    record(next, "started-tmux")
  } else if (keymap === "herdr" && normalized === "herdr") {
    next.lastAction = "started or attached to the default Herdr session"
    record(next, "started-herdr")
  } else if (keymap === "herdr" && normalized === "herdr plugin list") {
    next.lastAction = "listed installed Herdr plugins"
    record(next, "listed-plugins")
  }

  return next
}
